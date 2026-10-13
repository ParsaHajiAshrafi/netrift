import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSnapshot } from './diagnostics.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

export function createDashboardServer(options = {}) {
  const clients = new Set();
  const history = [];
  let latest = null;
  let timer = null;
  let running = false;

  const sample = async () => {
    if (running) return;
    running = true;
    try {
      const next = await collectSnapshot(options);
      const changed = latest && latest.signature !== next.signature;
      next.changed = Boolean(changed);
      latest = next;
      history.push(next);
      if (history.length > 120) history.shift();
      const payload = `data: ${JSON.stringify(next)}\n\n`;
      for (const client of clients) client.write(payload);
    } finally {
      running = false;
    }
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/snapshot') {
      if (!latest) await sample();
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return response.end(JSON.stringify({ latest, history }));
    }
    if (url.pathname === '/api/events') {
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'access-control-allow-origin': '*'
      });
      response.write(': connected\n\n');
      clients.add(response);
      request.once('close', () => clients.delete(response));
      return;
    }
    if (url.pathname === '/api/report') {
      if (!latest) await sample();
      const report = {
        generatedAt: new Date().toISOString(),
        tool: 'NetRift 0.1.0',
        privacy: 'Values are redacted before export. Review before sharing.',
        latest,
        changes: history.filter((item) => item.changed)
      };
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="netrift-report-${Date.now()}.json"`
      });
      return response.end(JSON.stringify(report, null, 2));
    }
    const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    if (!['index.html', 'app.js', 'styles.css', 'logo.svg'].includes(requested)) {
      response.writeHead(404);
      return response.end('Not found');
    }
    try {
      const file = await readFile(join(root, requested));
      response.writeHead(200, { 'content-type': mime[extname(requested)] || 'application/octet-stream' });
      response.end(file);
    } catch {
      response.writeHead(500);
      response.end('Dashboard asset unavailable');
    }
  });

  return {
    server,
    start(port = 4177, host = '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, async () => {
          await sample();
          timer = setInterval(sample, options.interval || 5000);
          timer.unref();
          resolve(server.address());
        });
      });
    },
    close() {
      if (timer) clearInterval(timer);
      for (const client of clients) client.end();
      return new Promise((resolve) => server.close(resolve));
    }
  };
}

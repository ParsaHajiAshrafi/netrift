import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import { performance } from 'node:perf_hooks';

const DEFAULT_TARGETS = [
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'npm', url: 'https://registry.npmjs.org/-/ping' },
  { name: 'Cloudflare', url: 'https://1.1.1.1/cdn-cgi/trace' }
];

const PRIVATE_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export function redact(value = '') {
  return String(value)
    .replace(/([a-z]+:\/\/)([^/@\s]+)@/gi, '$1***@')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, (ip) => PRIVATE_V4.test(ip) ? ip.replace(/\.\d+$/, '.x') : ip)
    .replace(/(token|key|secret|password|authorization)(["'=:\s]+)[^\s,"'}]+/gi, '$1$2***');
}

export function activeInterfaces(source = os.networkInterfaces()) {
  return Object.entries(source).flatMap(([name, addresses = []]) =>
    addresses
      .filter((item) => !item.internal && (item.family === 'IPv4' || item.family === 4))
      .map((item) => ({ name, address: redact(item.address), cidr: redact(item.cidr || '') }))
  );
}

export function detectVpn(interfaces) {
  const pattern = /(vpn|tun|tap|wireguard|wg\d*|tailscale|zerotier|proton|nord|warp)/i;
  return interfaces.filter((item) => pattern.test(item.name)).map((item) => item.name);
}

export function proxyState(env = process.env) {
  const keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY'];
  return Object.fromEntries(keys.flatMap((key) => {
    const value = env[key] || env[key.toLowerCase()];
    return value ? [[key, redact(value)]] : [];
  }));
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

export async function dnsProbe(hostname = 'github.com', timeout = 3500) {
  const start = performance.now();
  try {
    const result = await withTimeout(dns.lookup(hostname, { all: true }), timeout, 'DNS');
    return { ok: true, latency: Math.round(performance.now() - start), answers: result.slice(0, 3).map((x) => redact(x.address)) };
  } catch (error) {
    return { ok: false, latency: Math.round(performance.now() - start), error: redact(error.message) };
  }
}

export function tcpProbe(host, port = 443, timeout = 3500) {
  const start = performance.now();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ...payload, latency: Math.round(performance.now() - start) });
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish({ ok: true }));
    socket.once('timeout', () => finish({ ok: false, error: `TCP timed out after ${timeout}ms` }));
    socket.once('error', (error) => finish({ ok: false, error: redact(error.message) }));
  });
}

export function httpsProbe(target, timeout = 5000) {
  const start = performance.now();
  return new Promise((resolve) => {
    const request = https.get(target.url, {
      timeout,
      headers: { 'user-agent': 'NetRift/0.1 (+https://github.com/ParsaHajiAshrafi/netrift)' }
    }, (response) => {
      response.resume();
      const certificate = response.socket.getPeerCertificate?.();
      const expiresAt = certificate?.valid_to ? new Date(certificate.valid_to) : null;
      resolve({
        name: target.name,
        url: target.url,
        ok: Boolean(response.statusCode && response.statusCode < 500),
        status: response.statusCode,
        latency: Math.round(performance.now() - start),
        tlsDaysLeft: expiresAt ? Math.ceil((expiresAt - Date.now()) / 86400000) : null
      });
    });
    request.once('timeout', () => request.destroy(new Error(`HTTPS timed out after ${timeout}ms`)));
    request.once('error', (error) => resolve({
      name: target.name,
      url: target.url,
      ok: false,
      latency: Math.round(performance.now() - start),
      error: redact(error.message)
    }));
  });
}

export function classify(snapshot) {
  if (!snapshot.interfaces.length) return { level: 'down', cause: 'adapter', message: 'No active IPv4 network adapter detected.' };
  if (!snapshot.dns.ok && !snapshot.tcp.ok) return { level: 'down', cause: 'route', message: 'DNS and direct TCP connectivity both failed.' };
  if (!snapshot.dns.ok && snapshot.tcp.ok) return { level: 'degraded', cause: 'dns', message: 'The network route works, but name resolution is failing.' };
  const failed = snapshot.targets.filter((target) => !target.ok);
  if (failed.length === snapshot.targets.length) return { level: 'down', cause: 'https', message: 'Every HTTPS probe failed.' };
  if (failed.length) return { level: 'degraded', cause: 'endpoint', message: `${failed.length} endpoint probe${failed.length > 1 ? 's' : ''} failed.` };
  if (snapshot.dns.latency > 500) return { level: 'degraded', cause: 'latency', message: 'DNS is responding slowly.' };
  return { level: 'healthy', cause: 'none', message: 'All network layers are responding normally.' };
}

export async function collectSnapshot(options = {}) {
  const targets = options.targets?.length ? options.targets : DEFAULT_TARGETS;
  const interfaces = activeInterfaces();
  const [dnsResult, tcpResult, targetResults] = await Promise.all([
    dnsProbe(options.dnsHost || 'github.com'),
    tcpProbe(options.tcpHost || '1.1.1.1', options.tcpPort || 443),
    Promise.all(targets.map((target) => httpsProbe(target)))
  ]);
  const snapshot = {
    timestamp: new Date().toISOString(),
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    hostname: redact(os.hostname()),
    interfaces,
    vpn: detectVpn(interfaces),
    proxy: proxyState(),
    dns: dnsResult,
    tcp: tcpResult,
    targets: targetResults
  };
  snapshot.diagnosis = classify(snapshot);
  snapshot.signature = JSON.stringify({
    interfaces: interfaces.map((item) => item.name).sort(),
    vpn: snapshot.vpn.slice().sort(),
    proxy: Object.keys(snapshot.proxy).sort(),
    dns: snapshot.dns.ok,
    tcp: snapshot.tcp.ok,
    targets: snapshot.targets.map((item) => [item.name, item.ok])
  });
  return snapshot;
}

export { DEFAULT_TARGETS };

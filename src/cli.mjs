#!/usr/bin/env node
import { collectSnapshot } from './diagnostics.mjs';
import { createDashboardServer } from './server.mjs';

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
NetRift — catch the network change that broke your dev session

Usage:
  netrift                  Start the live local dashboard
  netrift --once           Print one redacted diagnosis
  netrift --json           Print one JSON snapshot
  netrift --port 8080      Choose dashboard port (default: 4177)
  netrift --host 0.0.0.0   Listen on another interface

No telemetry. No account. No cloud storage.
`);
  process.exit(0);
}

if (args.includes('--once') || args.includes('--json')) {
  const snapshot = await collectSnapshot();
  if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    const icon = snapshot.diagnosis.level === 'healthy' ? '✓' : snapshot.diagnosis.level === 'degraded' ? '!' : '×';
    console.log(`${icon} ${snapshot.diagnosis.level.toUpperCase()} — ${snapshot.diagnosis.message}`);
    console.log(`  DNS ${snapshot.dns.ok ? `${snapshot.dns.latency}ms` : 'failed'} · TCP ${snapshot.tcp.ok ? `${snapshot.tcp.latency}ms` : 'failed'} · VPN ${snapshot.vpn.join(', ') || 'not detected'}`);
  }
  process.exit(snapshot.diagnosis.level === 'down' ? 1 : 0);
}

const port = Number(valueFor('--port', process.env.NETRIFT_PORT || 4177));
const host = valueFor('--host', process.env.NETRIFT_HOST || '127.0.0.1');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be an integer between 1 and 65535.');

const dashboard = createDashboardServer();
const address = await dashboard.start(port, host);
console.log(`\n  NetRift is recording network changes\n  http://${host === '0.0.0.0' ? 'localhost' : host}:${address.port}\n`);
console.log('  Press Ctrl+C to stop. Nothing leaves this machine.\n');

const shutdown = async () => {
  await dashboard.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

import test from 'node:test';
import assert from 'node:assert/strict';
import { activeInterfaces, classify, detectVpn, redact } from '../src/diagnostics.mjs';

test('redacts credentials and private IPv4 host parts', () => {
  assert.equal(redact('http://admin:secret@192.168.1.42:8080'), 'http://***@192.168.1.x:8080');
  assert.match(redact('token=super-secret-value'), /token=\*\*\*/);
});

test('filters loopback interfaces and redacts addresses', () => {
  const interfaces = activeInterfaces({
    Loopback: [{ internal: true, family: 'IPv4', address: '127.0.0.1' }],
    Ethernet: [{ internal: false, family: 'IPv4', address: '192.168.4.22', cidr: '192.168.4.22/24' }]
  });
  assert.deepEqual(interfaces, [{ name: 'Ethernet', address: '192.168.4.x', cidr: '192.168.4.x/24' }]);
});

test('detects common tunnel interface names', () => {
  assert.deepEqual(detectVpn([{ name: 'Ethernet' }, { name: 'Cloudflare WARP' }, { name: 'wg0' }]), ['Cloudflare WARP', 'wg0']);
});

test('classifies DNS-only failure as degraded', () => {
  const diagnosis = classify({ interfaces: [{ name: 'Wi-Fi' }], dns: { ok: false }, tcp: { ok: true }, targets: [{ ok: true }] });
  assert.equal(diagnosis.cause, 'dns');
  assert.equal(diagnosis.level, 'degraded');
});

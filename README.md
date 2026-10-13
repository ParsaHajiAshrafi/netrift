<div align="center">
  <img src="public/logo.svg" width="88" alt="NetRift logo">
  <h1>NetRift</h1>
  <p><strong>The local-first network flight recorder for developers.</strong></p>
  <p>Catch the VPN flip, DNS stall, proxy leak, TLS failure or endpoint outage that broke your coding session.</p>

  [![CI](https://github.com/ParsaHajiAshrafi/netrift/actions/workflows/ci.yml/badge.svg)](https://github.com/ParsaHajiAshrafi/netrift/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/license-MIT-52f4b1.svg)](LICENSE)
  [![Node.js 20+](https://img.shields.io/badge/node-20%2B-41b7ff.svg)](https://nodejs.org)
</div>

---

Your AI agent says `ERR_NETWORK_CHANGED`. The terminal says a stream was destroyed. Everything works again before you can inspect it.

**NetRift keeps the black box running.** It samples the layers that matter, notices when the network signature changes, and gives you a clean local dashboard plus a redacted support report.

## Start in one command

```bash
npx netrift
```

Then open **http://localhost:4177**. No sign-up, API key, database, Docker or cloud service.

> Until the npm package is released, clone the repository and run `npm start`.

## What it catches

| Signal | Why it matters |
|---|---|
| Active adapter changes | Wi-Fi/Ethernet hand-offs often kill long-lived streams |
| VPN/tunnel appearance | Route changes can invalidate WebSocket and TLS sessions |
| DNS health and latency | A working route can still have broken name resolution |
| Direct TCP reachability | Separates DNS failures from route/firewall failures |
| HTTPS endpoint probes | Shows whether the outage is global or service-specific |
| TLS certificate lifetime | Surfaces certificate expiry before it becomes an outage |
| Proxy environment | Detects stale or unexpected development proxy settings |
| Network signature timeline | Records exactly when the environment changed |

## Privacy model

- Runs only on `127.0.0.1` by default.
- No account, telemetry, analytics or remote storage.
- Private IPv4 host parts, URL credentials and common secret fields are redacted.
- Exported reports contain only diagnostic evidence; still review before sharing.
- Read-only: NetRift never changes adapters, routes, DNS or proxy settings.

## CLI

```text
netrift                  Start the live dashboard
netrift --once           Print one human-readable diagnosis
netrift --json           Print one JSON snapshot
netrift --port 8080      Choose a port
netrift --host 0.0.0.0   Opt in to LAN access
```

## Why another network tool?

Speed tests answer “how fast is the connection?” NetRift answers **“what changed at the moment my development session died?”** It is focused on long-running coding agents, package registries, Git hosting and local development — and it keeps running quietly until the failure happens.

## Roadmap

- [ ] WebSocket heartbeat probe
- [ ] Route and public-IP change detection
- [ ] Configurable project endpoint profiles
- [ ] Incident bundles with before/after snapshots
- [ ] Optional system tray mode
- [ ] Signed standalone binaries

## Contributing

Bug reports and small, focused pull requests are welcome. Please avoid adding telemetry or cloud requirements. Run the cross-platform checks before opening a PR:

```bash
npm test
npm run check
```

## License

MIT © 2026 [Parsa HajiAshrafi](https://github.com/ParsaHajiAshrafi)

# Contributing to NetRift

Thanks for helping make network failures easier to explain.

## Good first contributions

- Add a deterministic probe with tests.
- Improve failure classification without hiding raw evidence.
- Verify behavior on a platform not covered by an existing test.
- Improve accessibility, documentation, or the local dashboard.

## Ground rules

1. Keep diagnostics read-only by default.
2. Do not add telemetry, accounts, tracking pixels, or cloud storage.
3. Redact private addresses and credentials before data reaches the UI or export.
4. Avoid dependencies unless the capability cannot reasonably use Node.js core APIs.
5. Never report a network cause without evidence that distinguishes it from adjacent layers.

## Development

```bash
git clone https://github.com/ParsaHajiAshrafi/netrift.git
cd netrift
npm test
npm start
```

Before opening a pull request:

```bash
npm test
npm run check
```

Please explain the failure scenario, expected evidence, operating systems tested, and privacy impact in the pull request.

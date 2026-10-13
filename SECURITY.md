# Security policy

## Supported versions

Security fixes currently target the latest release on `main`.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for this repository. Do not open a public issue containing credentials, private addresses, exported reports, or other sensitive diagnostic data.

Include the affected version, reproduction steps, impact, and a suggested mitigation if available. You should receive an acknowledgement within seven days.

## Security boundaries

NetRift is read-only and binds to `127.0.0.1` by default. Using `--host 0.0.0.0` deliberately exposes the dashboard and report endpoint to the local network. Exported reports are redacted, but users should still review them before sharing.

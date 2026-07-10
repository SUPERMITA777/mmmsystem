# Rules for Antigravity Coding Assistant

## Printer Bridge Versioning Rule
- Every time a change is made to the printer bridge code (`scripts/printer-bridge.js` or `public/bridge/printer-bridge.js`), you must increment the version number by `0.1` (e.g. `v4.0` -> `v4.1` -> `v4.2`).
- Update the version string in the file header, in the log output, and in the `/status` API endpoint response.

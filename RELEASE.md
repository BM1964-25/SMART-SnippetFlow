# SMART SnippetFlow Release

## Local builds

```bash
npm run typecheck
npm run build
npm run pack
npm run dist:mac
npm run dist:win
```

Generated installers are written to `release/`.

## Current targets

- macOS Apple Silicon: `dmg` and `zip`
- Windows x64: NSIS installer

## Signing and notarization

The build configuration is prepared for packaging. Final public distribution still needs trusted certificates:

- macOS: Apple Developer ID Application certificate plus notarization credentials.
- Windows: OV or EV code-signing certificate.

Electron Builder reads signing credentials from environment variables such as `CSC_LINK`, `CSC_KEY_PASSWORD`, and Apple notarization variables. Without these credentials the app can be built, but macOS Gatekeeper and Windows SmartScreen may show trust warnings.

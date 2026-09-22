#!/usr/bin/env node
// Backwards-compatible aggregate gate. Prefer release:web or release:mobile
// when only one deployable is being released.
await import("./release-web.mjs");
await import("./release-mobile.mjs");

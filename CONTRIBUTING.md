# Contributing

Keep the renderer framework-independent and free of runtime dependencies. Run `npm ci` and `npm run verify` before proposing a change. Update contract tests for item identity, motion, callback behavior and cleanup when those contracts change.

Add only artwork and code with clear origin and compatible permission. Do not import proprietary client resources, copyrighted album photographs, real lyrics, access tokens, private app binaries or account/session logs. Keep SVGs small and free of scripts and external references. Update asset hashes and notices when changing assets.

Document behavior changes, browser acceptance and any accessibility tradeoffs. Avoid introducing a permanent idle frame loop or retaining offscreen image/DOM references.

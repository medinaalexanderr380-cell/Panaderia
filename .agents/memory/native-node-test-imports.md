---
name: Native Node test imports
description: A limitation of the native Node TypeScript test runner with workspace package imports.
---

The native Node test runner with `--experimental-strip-types` cannot resolve extensionless directory imports from workspace TypeScript packages, even when the application build bundles them successfully.

**Why:** Importing an API route directly in a unit test can fail during module resolution before the route or its middleware runs.

**How to apply:** Keep authorization regressions focused on independently importable middleware and source-level route wiring, or test full routes through the bundled/running server rather than importing database-backed route modules directly.
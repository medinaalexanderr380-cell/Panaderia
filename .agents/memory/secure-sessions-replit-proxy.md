---
name: Secure sessions behind Replit proxy
description: Production cookie sessions must account for HTTPS termination at Replit's reverse proxy.
---

When an Express app uses secure session cookies in production, it must trust Replit's reverse proxy so the original HTTPS request is recognized.

**Why:** Without proxy trust, login endpoints can return success while failing to emit or retain the secure cookie; every following protected request then returns 401.

**How to apply:** Preserve proxy trust whenever changing session, cookie, authentication, or production-server configuration, and verify that a protected request succeeds immediately after session creation.
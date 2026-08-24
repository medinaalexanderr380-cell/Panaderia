---
name: Dynamic truck stock migration
description: How legacy fixed truck stock is preserved while supporting editable delivery vehicles.
---

Truck inventory is dynamic. Keep the one-time migration marker when changing truck or stock behavior: it transfers Michel and David plus their legacy stock into the dynamic tables only once.

**Why:** The older fixed stock columns cannot represent added trucks. Re-running a fallback migration after an administrator deletes a truck would silently recreate it, so the migration must be permanently recorded.

**How to apply:** Route all truck stock operations through the dynamic inventory model. Treat the legacy per-person stock fields as migration input only, not as a live source of truth.
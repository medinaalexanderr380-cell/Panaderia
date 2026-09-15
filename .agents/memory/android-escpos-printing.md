---
name: Android ESC/POS printing
description: Reliable receipt delivery from the web app to a Bluetooth Classic thermal printer on Android.
---

Use Open ESC/POS Print Service’s documented `print-intent` interface for Android receipt printing instead of relying on `window.print()` and the system printer selector.

**Why:** On supported phones the printer’s test succeeds, but Android may omit the installed print service from its preview selector. Browser print previews and popup-based documents can also render blank or omit controls.

**How to apply:** Build a self-contained HTML receipt, gzip a JSON array containing that page, base64-encode it, and launch the `print-intent` URL. Keep ordinary browser printing only as a non-Android fallback.
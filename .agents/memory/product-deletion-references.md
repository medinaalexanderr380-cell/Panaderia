---
name: Product deletion references
description: Safe deletion policy for products linked to combos or delivery-vehicle stock.
---

Products with active references in a combo or in delivery-vehicle stock must not be cascade-deleted. The application should block deletion and explain the references that must be removed first.

**Why:** Automatically removing a product would silently alter a promotion or erase inventory assignments, which can produce incomplete combos and inaccurate delivery stock.

**How to apply:** Keep product deletion as a guarded operation. Delete a combo together with its items explicitly, then allow its unreferenced products to be deleted normally.
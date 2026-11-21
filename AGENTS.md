# ShopLedger

## Stack

- Node.js with CommonJS, Express 4, and `body-parser` for JSON requests.
- Static HTML, CSS, and browser JavaScript in `public/`, served by `server.js`.
- Local JSON persistence in `data/db.json`.

## Module map

- `routes/customers.js` lists Khata accounts and recent settlements and records settlements.
- `routes/orders.js` lists, retrieves, creates, and cancels orders.
- `routes/products.js` lists and filters products and lists active coupons.
- `routes/reports.js` serves the dashboard, GST reconciliation, cart pricing preview, and data export.
- `lib/coupons.js` normalizes and validates codes, calculates discounts, and lists active coupons.
- `lib/dates.js` formats dates, normalizes date strings, and derives fiscal-year labels.
- `lib/inventory.js` looks up products, checks sellable stock, applies stock updates, and summarizes inventory.
- `lib/invoice.js` recomputes invoice figures, renders printable HTML, and flags total mismatches.
- `lib/ledger.js` manages Khata balances, credit-limit checks, order debits, reversals, and settlements.
- `lib/orders.js` creates, retrieves, filters, and cancels order records.
- `lib/pricing.js` apportions coupon discounts and computes checkout totals with per-line GST.
- `lib/reports.js` aggregates dashboard metrics and compares invoice figures with saved order totals and tax.
- `lib/store.js` reads and writes the JSON store and appends audit entries.
- `lib/tax.js` resolves GST rates and splits tax into CGST and SGST.

## Commands

- Start from the repo root with `node server.js`. The default port is 3000 and `PORT` overrides it.
- Run tests from the repo root with `node --test`. The repo currently contains no test files.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Use in-memory data in tests. Never read or write `data/db.json` from a test.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

The printable invoice total and GST breakdown can differ from what the customer was billed. Checkout applies HSN GST to discounted lines, while the invoice recomputes GST on gross lines using the saved rate or the default.

Allowed files for the fix are `lib/invoice.js` and, only if truly needed, `lib/tax.js`.

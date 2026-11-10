# 0002 — CSV export of the orders list

## What

People who reconcile orders want them in a spreadsheet. Add an Export CSV button to the orders list
that downloads exactly the rows the current filters show.

## Behaviour

- The orders list shows an **Export CSV** button next to the filters.
- Pressing it downloads `orders-YYYY-MM-DD.csv` with one header row and one row per visible order.
- Columns: order number, date, customer, status, total.
- With no orders visible the button is disabled with the hint "Nothing to export".
- If the export fails, a toast says "Export failed — try again" and nothing downloads.

## Scope

In:
- The button, the CSV file, the empty and error states.

Out:
- Excel format; scheduled exports.

## Touchpoints

- src/pages/orders/OrdersList.tsx — the list and its filters
- src/lib/download.ts — existing file-download helper

## Open questions

- Include archived orders when the "show archived" filter is on?
  **Resolved 2026-11-08 (human): yes, export follows the filters exactly**

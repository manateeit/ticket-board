# Eval — 0002 — CSV export of the orders list

## Checks

1. Project tests
   - Run: `npm test`
   - Pass: all tests pass, including a new test for the CSV builder
   - Result:
   - Evidence:

2. End-to-end export
   - Run: open /orders in the browser, filter to status "paid", press Export CSV
   - Pass: the downloaded file has a header row and exactly the visible paid orders
   - Result:
   - Evidence:

## Not checked by automation

- The button's placement looks right next to the filters.

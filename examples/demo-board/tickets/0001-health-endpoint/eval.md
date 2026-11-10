# Eval — 0001 — Health endpoint

## Checks

1. Unit tests
   - Run: `npm test`
   - Pass: all tests pass
   - Result: PASS
   - Evidence: 42 passed

2. End-to-end
   - Run: `curl -s localhost:3000/health`
   - Pass: `{"status":"ok"}`
   - Result: PASS
   - Evidence: {"status":"ok"}

## Not checked by automation

- none

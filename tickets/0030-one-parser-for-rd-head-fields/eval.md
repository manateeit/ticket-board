# Eval — 0030 — One parser for rd.md head fields

## Checks

1. Plugin validates and tests pass
   - Run: `claude plugin validate .` then `claude plugin test .`
   - Pass: both exit 0; no test skipped or deleted

2. Body `type:` lines are shown (fails before the fix)
   - Run: pane test: rd.md with `type: module` inside a code fence in Behaviour
   - Pass: the line appears in the desktop ticket view; the head Type line does not

3. Long head is read
   - Run: core test: Type: on line 15, before the first ##
   - Pass: kindOf returns that type

4. setKind edits only the head
   - Run: core/pane test: short head with no Type and a body `Type:` line; change Type
   - Pass: a head line is added; the body line is unchanged

5. Single parser
   - Run: `grep -rnE 'slice\(0, ?12\)|\^type:' hooks`
   - Pass: no separate head scans remain

6. Docs and README updated
   - Run: read README.md and the docs in rd.md `## Docs`
   - Pass: they describe the change as built
## Not checked by automation

- none

// An adopt proposal (0009) as the adopt agent writes it, for the core and pane tests. The source
// notes already use D1/D3 and P1.1, so those ids are kept; D2 is new and P2 has no build yet.

export const ADOPT_NOTES = `# Salon notes

Accounts (D1): owners sign in with a magic link.
Booking (D3): clients book a free slot.
Maybe a waitlist one day?
`

export const adoptProposal = (date: string) => `---
change: adopt
date: ${date}
sources: notes/salon.md
---
# Adopt existing docs

## Sources
- notes/salon.md: D1, D2, D3, P1, P1.1, P1.2, P2, P2.1
- notes/old-standup.md: left out (meeting notes with nothing to build)

## Reasons
- D1: "Accounts (D1)" in notes/salon.md, id kept
- D2: the salon page the notes assume; new id
- D3: "Booking (D3)" in notes/salon.md, id kept
- P1: the first milestone in the notes
- P1.1: sign-in, from the Accounts line
- P1.2: booking, from the Booking line
- P2: the "one day" ideas
- P2.1: the waitlist idea

## DESIGN.md
~~~~markdown
---
design: Salon
version: 1
status: draft
updated: ${date}
---
# Salon: design

## Vision
Online booking for small salons.

## D1 · Accounts
Rev: 1
Why: Owners need their own view.
What: Owners sign in with a magic link.
Done when:
- An owner signs in with a link

## D2 · Salon page
Rev: 1
Why: Clients need to find the salon.
What: A public page per salon.
Done when:
- The page shows services and hours

## D3 · Booking
Rev: 1
Why: Booking without a phone call.
What: Clients book a free slot.
Done when:
- A free slot can be booked

### Open questions
- [ ] Should a full day offer a waitlist? (the notes say "maybe one day")
~~~~

## PLAN.md
~~~~markdown
---
plan: Salon
design-version: 1
updated: ${date}
---
# Salon: plan

## P1 · Foundations
Goal: owners sign in and clients book.
Appetite: 2 weeks
Exit: a client books a slot.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Magic link sign-in | S | — | D1 | an owner signs in | — |
| P1.2 | Book a slot | M | P1.1 | D2, D3 | a free slot is booked | — |

## P2 · Later
Goal: fill full days.
Appetite: 1 week
Exit: a waitlist exists.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P2.1 | Waitlist | M | P1.2 | D3 | a full day offers a waitlist | — |
~~~~
`

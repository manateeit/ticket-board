---
plan: Chairside
design-version: 2
updated: 2026-11-03
---
# Chairside: plan

## P1 · Foundations
Goal: owners can sign in and publish their salon.
Appetite: 2 weeks
Exit: a real salon has a public page.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P1.1 | Email link sign-in | S | — | D1 | owners and clients sign in with a link | 0001 |
| P1.2 | Salon profile page | M | P1.1 | D2 | the public page shows services and hours | 0002 |

## P2 · Booking
Goal: clients book without calling.
Appetite: 3 weeks
Exit: a client books, gets a confirmation and a reminder.

| # | Build | Size | Needs | Covers | Done when | Ticket |
|---|---|---|---|---|---|---|
| P2.1 | Book a free slot | L | P1.2 | D3 | a booking is confirmed by email and slots never double up | 0003 |
| P2.2 | Day-before reminders | M | P2.1 | D4 | each booking gets one reminder | 0004 |

## P3 · Growth
Goal: salons fill their gaps and win new clients.
Appetite: 2 weeks
Exit: a full day offers a waitlist and salon pages show ratings.

| # | Build | Size | Needs | Covers | Done when | Ticket | Status |
|---|---|---|---|---|---|---|---|
| P3.1 | Ratings and reviews | S | P2.1 | D6 | the salon page shows the average rating | 0005 | |
| P3.2 | Waitlist for full days | M | P2.1 | D3 | a full day offers the waitlist | — | |
| P3.3 | Staff mobile app | L | P1.1 | D5 | staff see their day on a phone | — | dropped |

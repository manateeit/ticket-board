---
design: Chairside
version: 2
status: approved
updated: 2026-11-02
---
# Chairside: design

## Vision
Online booking for small salons, so owners stop losing clients to phone tag.

## Users
Salon owners with one to five chairs, and their clients booking from a phone.

## Non-goals
- Payroll and stock management.

## D1 · Accounts
Rev: 1
Why: Owners and clients need their own view of bookings.
What: Owners and clients sign in with an email link; no passwords.
Done when:
- An owner signs in with an email link and sees their salon
- A client signs in with an email link and sees their bookings

## D2 · Salon profile
Rev: 1
Why: Clients choose a salon by its services, hours and staff.
What: A public page per salon with services, prices, opening hours and staff.
Done when:
- An owner edits services, prices and hours and the public page shows them

## D3 · Online booking
Rev: 2
Why: Booking must work without a phone call, also when a slot is taken.
What: Clients pick a service, a staff member and a free slot and book it; a full day offers a waitlist.
Done when:
- WHEN a client books a free slot THE SYSTEM SHALL confirm it by email within a minute
- Two clients can never book the same slot
- A full day offers the waitlist

### Open questions
- [x] Can a client book for someone else?
  **Resolved 2026-11-02 (human): yes, with that person's name and phone**

## D4 · Reminders
Rev: 1
Why: No-shows cost owners a slot.
What: A reminder email goes out the day before each booking.
Done when:
- Every booking gets one reminder 24 hours before it

## D5 · ~~Staff mobile app~~
Status: dropped in v2 (see changes/2026-11-02-design-v2.md)

## D6 · Reviews
Rev: 1
Why: New clients trust salons other clients rate well.
What: After a visit the client can rate the salon and leave a short review.
Done when:
- A client rates a past booking from 1 to 5 and the salon page shows the average

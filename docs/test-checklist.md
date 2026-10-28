# Test checklist

Two browser windows: one logged in as `owner@example.com` (admin), one as `customer@example.com`.

- [ ] Admin: add a vehicle with the form; it appears in the customer's Fleet.
- [ ] Admin: import `api/scripts/vehicles.sample.csv`; re-import it and see duplicates skipped by VIN.
- [ ] Admin: add lockbox 7 with a code, assign it to the new vehicle.
- [ ] Customer: book the new vehicle for tomorrow; a second overlapping booking is refused.
- [ ] Customer: "Get lockbox code" is not shown (pending, unpaid, window closed).
- [ ] Admin: confirm and tick paid; customer still sees no button (window closed).
- [ ] Admin: set the pickup window to 48 hours; customer now sees the button.
- [ ] Customer: tap it; popup shows lockbox 7 and the right code; booking becomes ACTIVE.
- [ ] Customer2: cannot reveal customer1's code (403).
- [ ] Admin: complete the booking; Lockboxes page flags box 7 "rotate"; rotate it; old code gone.
- [ ] Admin: try to retire a vehicle with a future booking; refused with the count.
- [ ] Customer: submit a support ticket; it appears on the admin dashboard.
- [ ] Customer: /admin redirects home; direct API calls to /admin/* and /lockboxes return 403.
- [ ] Admin: cannot change own role (API returns 400).



## Event and Reservation Enhancements

This plan addresses four key improvements:

1. **Location and Cost Fields** for event creation
2. **Dietary Restrictions** field for reservations (visible to event owners)
3. **Confirmed vs Waitlist Lists** for event owners
4. **Fix Available Spots Input Bug**

---

### Issue 1: Add Location and Estimated Cost Fields to Events

#### What You'll See
When creating or editing an event, two new optional fields will appear:
- **Location**: Text field for the venue/address
- **Estimated Cost per Person**: Currency input (e.g., "$25")

These will display on event cards in the Upcoming Events list and in booking confirmations.

#### Technical Details

| Component | Change |
|-----------|--------|
| **Database** | Add `location` (text, nullable) and `estimated_cost_per_person` (numeric, nullable) columns to `availability_slots` table |
| `src/lib/types.ts` | Update `AvailabilitySlot` interface with new fields |
| `src/components/admin/AvailabilityManager.tsx` | Add location and cost input fields to creation form |
| `src/components/admin/EditSlotModal.tsx` | Add location and cost input fields to edit form |
| `src/components/customer/EventCard.tsx` | Display location and cost on event cards |
| `src/components/customer/BookingModal.tsx` | Show location and cost in booking confirmation |

---

### Issue 2: Dietary Restrictions for Reservations

#### What You'll See
**For Users (when booking):**
- New text field: "Dietary Restrictions (optional)" with placeholder text like "e.g., Vegetarian, Gluten-free, Nut allergy"

**For Event Owners (in Reservations list):**
- Each participant's dietary restrictions displayed alongside their booking info

#### Technical Details

| Component | Change |
|-----------|--------|
| **Database** | Add `dietary_restrictions` (text, nullable) column to `bookings` table |
| `src/components/customer/BookingModal.tsx` | Add dietary restrictions input field |
| `src/hooks/useAvailabilitySlots.ts` | Pass dietary restrictions in booking mutation |
| `src/hooks/useWaitlist.ts` | Pass dietary restrictions when joining waitlist |
| `src/components/admin/ReservationsList.tsx` | Display dietary restrictions for each booking |
| **Waitlist table** | Add `dietary_restrictions` column to `waitlist_entries` |
| `get_participant_payment_info` RPC | Update to include dietary_restrictions |

---

### Issue 3: Separate Confirmed and Waitlist Views for Event Owners

#### What You'll See
In the "Reservations for Your Events" section, each event will show:
- **Confirmed Guests** tab with count badge
- **Waitlist** tab with count badge (only if waitlist is enabled)

Each list shows the attendee name, email, party size, and dietary restrictions.

#### Technical Details

| Component | Change |
|-----------|--------|
| `src/hooks/useOwnerBookings.ts` | Add `useOwnerWaitlistEntries()` hook to fetch waitlist for owned slots |
| `src/components/admin/ReservationsList.tsx` | Add sub-tabs per event showing "Confirmed" and "Waitlist" with counts |

---

### Issue 4: Fix "Available Spots" Input Bug

#### The Problem
The current implementation uses:
```typescript
onChange={(e) => setTotalSpots(Math.max(1, parseInt(e.target.value) || 1))}
```

This prevents the user from clearing the field to type a new number because:
- When user selects "1" and tries to delete it, the field becomes empty
- `parseInt('')` returns `NaN`
- `NaN || 1` evaluates to `1`
- So the field snaps back to "1" immediately

#### The Fix
Allow the input to be empty during editing, only enforcing minimum on blur or submit:
```typescript
const [totalSpotsInput, setTotalSpotsInput] = useState('1');

// On change: allow any value including empty
onChange={(e) => setTotalSpotsInput(e.target.value)}

// On blur: enforce minimum
onBlur={() => {
  const parsed = parseInt(totalSpotsInput);
  if (isNaN(parsed) || parsed < 1) {
    setTotalSpotsInput('1');
  }
}}
```

#### Files to Update
- `src/components/admin/AvailabilityManager.tsx` - Fix the Available Spots input
- `src/components/admin/EditSlotModal.tsx` - Fix the Total Spots input

---

### Summary of Changes

| File | Action | Purpose |
|------|--------|---------|
| **Database Migration** | Create | Add `location`, `estimated_cost_per_person` to `availability_slots`; Add `dietary_restrictions` to `bookings` and `waitlist_entries` |
| `src/lib/types.ts` | Modify | Add new fields to types |
| `src/components/admin/AvailabilityManager.tsx` | Modify | Add location/cost fields, fix spots bug |
| `src/components/admin/EditSlotModal.tsx` | Modify | Add location/cost fields, fix spots bug |
| `src/components/customer/BookingModal.tsx` | Modify | Add dietary restrictions field, show location/cost |
| `src/hooks/useAvailabilitySlots.ts` | Modify | Include dietary restrictions in booking |
| `src/hooks/useWaitlist.ts` | Modify | Include dietary restrictions in waitlist join |
| `src/hooks/useOwnerBookings.ts` | Modify | Add waitlist query for owned slots, include dietary restrictions |
| `src/components/admin/ReservationsList.tsx` | Modify | Show confirmed vs waitlist tabs, display dietary restrictions |
| `src/components/customer/EventCard.tsx` | Modify | Display location and cost |
| `get_participant_payment_info` RPC | Update | Return dietary_restrictions |

---

### Database Schema Changes

```text
availability_slots
├── location (text, nullable) - NEW
└── estimated_cost_per_person (numeric, nullable) - NEW

bookings
└── dietary_restrictions (text, nullable) - NEW

waitlist_entries
└── dietary_restrictions (text, nullable) - NEW
```

---

### User Interface Flow

**Event Creation (Host):**
```text
┌─────────────────────────────────────────┐
│ Create Availability                      │
├─────────────────────────────────────────┤
│ Event Name: [Wine Tasting Evening    ]  │
│ Description: [Premium wine selection ]  │
│                                         │
│ Location (optional):                    │
│ [123 Main St, Downtown              ]   │
│                                         │
│ Est. Cost/Person (optional):            │
│ [$25.00                             ]   │
│                                         │
│ Date: [Feb 5, 2026  ]                   │
│ Start: [6:30 PM] End: [8:30 PM]         │
│ Available Spots: [8            ]        │
│                                         │
│ [Create Availability]                   │
└─────────────────────────────────────────┘
```

**Booking (Customer):**
```text
┌─────────────────────────────────────────┐
│ Complete Your Reservation               │
├─────────────────────────────────────────┤
│ Wine Tasting Evening                    │
│ 📍 123 Main St, Downtown                │
│ 💰 ~$25 per person                      │
│ Feb 5, 2026 · 6:30 PM                   │
├─────────────────────────────────────────┤
│ Booking as: John Doe                    │
│             john@email.com              │
│                                         │
│ Dietary Restrictions (optional):        │
│ [Vegetarian, no shellfish          ]   │
│                                         │
│ [Cancel]            [Confirm Booking]   │
└─────────────────────────────────────────┘
```

**Host View - Reservations:**
```text
┌─────────────────────────────────────────┐
│ Wine Tasting Evening - Feb 5            │
│ ┌───────────────┬────────────────┐      │
│ │ Confirmed (6) │ Waitlist (2)   │      │
│ └───────────────┴────────────────┘      │
├─────────────────────────────────────────┤
│ ✓ John Doe - john@email.com             │
│   Party: 2 | Diet: Vegetarian           │
│                                         │
│ ✓ Jane Smith - jane@email.com           │
│   Party: 1 | Diet: Gluten-free          │
│ ...                                     │
└─────────────────────────────────────────┘
```




## Enhanced SGD Discovery and Calendar Export Features

This plan implements three improvements to help users discover events and manage their reservations more effectively:

1. **Upcoming Events List View** - A scrollable list showing all upcoming SGDs with key details at a glance
2. **Calendar Event Count Badges** - Replace single green dot with count badges showing how many events are on each day
3. **ICS Calendar Export** - Download calendar invites for confirmed reservations

---

### Feature 1: Upcoming Events List View

#### What You'll See
Above the calendar, a new "Upcoming Events" section will display a scrollable list of all SGDs. Each event card will show:
- Event name and description
- Host name (from their profile)
- Date and time
- Spots availability (e.g., "3 of 8 spots left" or "Sold Out")
- Booking type badge (Instant Booking, Lottery, or Waitlist Available)
- Click to jump directly to the booking modal

#### Layout
```text
┌─────────────────────────────────────────────────────────────┐
│  📋 Upcoming Events                              View All → │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│ │ Wine Tasting    │ │ Omakase Night   │ │ Brunch Club     │ │
│ │ Hosted by Josh  │ │ Hosted by Mike  │ │ Hosted by Sarah │ │
│ │ Feb 5 · 7:00 PM │ │ Feb 8 · 6:30 PM │ │ Feb 10 · 11 AM  │ │
│ │ 🎟️ 3 spots left │ │ 🎲 Lottery      │ │ ⏳ Waitlist     │ │
│ │    [Book Now]   │ │  [Enter Lottery]│ │  [Join List]    │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Technical Implementation
| File | Changes |
|------|---------|
| `src/hooks/useUpcomingEventsWithHosts.ts` | New hook to fetch upcoming slots with host profiles joined |
| `src/components/customer/UpcomingEventsList.tsx` | New component - horizontal scrollable event cards |
| `src/components/customer/EventCard.tsx` | New component - individual event card with actions |
| `src/components/customer/CustomerView.tsx` | Add UpcomingEventsList above the calendar |

---

### Feature 2: Calendar Event Count Badges

#### What You'll See
Instead of a simple green dot, each date with events will show a small badge with the count of available events. Examples:
- "2" - Two events with open spots
- "3" - Three events with open spots
- Dates with no available spots show grayed styling

#### Visual Design
```text
┌────────────────────────────────────┐
│          February 2026             │
├────────────────────────────────────┤
│  Su   Mo   Tu   We   Th   Fr   Sa  │
│                              1     │
│   2    3    4    5    6    7    8  │
│                   ⬤2       ⬤1     │
│   9   10   11   12   13   14   15  │
│       ⬤3                           │
└────────────────────────────────────┘
```

#### Technical Implementation
| File | Changes |
|------|---------|
| `src/hooks/useMonthAvailability.ts` | Change return type from `Map<string, boolean>` to `Map<string, number>` (count of available events) |
| `src/components/customer/AvailabilityCalendar.tsx` | Update Day component to display count badge instead of dot |

---

### Feature 3: ICS Calendar Export

#### What You'll See
In the "My Reservations" section, confirmed bookings will show an "Add to Calendar" button. Clicking it downloads an .ics file that can be opened in Outlook, Google Calendar, Apple Calendar, etc.

The calendar event will include:
- Event title (SGD name)
- Date and time (with proper timezone)
- Description with party size and any event details

#### Technical Implementation
| File | Changes |
|------|---------|
| `src/lib/icsGenerator.ts` | New utility - generates ICS file content from booking data |
| `src/components/customer/MyReservations.tsx` | Add "Add to Calendar" button next to each confirmed upcoming booking |

#### ICS File Format
```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SGD Reservations//EN
BEGIN:VEVENT
DTSTART:20260205T190000Z
DTEND:20260205T210000Z
SUMMARY:Wine Tasting Experience
DESCRIPTION:Party of 2 guests\n\nHosted SGD event
UID:booking-abc123@sgd.app
END:VEVENT
END:VCALENDAR
```

---

### Summary of Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useUpcomingEventsWithHosts.ts` | Create | Fetch upcoming slots with host display names |
| `src/components/customer/UpcomingEventsList.tsx` | Create | Horizontal scrollable events list component |
| `src/components/customer/EventCard.tsx` | Create | Individual event card with booking actions |
| `src/lib/icsGenerator.ts` | Create | ICS file generation utility |
| `src/hooks/useMonthAvailability.ts` | Modify | Return event counts instead of boolean |
| `src/components/customer/AvailabilityCalendar.tsx` | Modify | Display count badges on calendar days |
| `src/components/customer/CustomerView.tsx` | Modify | Add UpcomingEventsList component |
| `src/components/customer/MyReservations.tsx` | Modify | Add "Add to Calendar" button |

---

### Database Considerations

To display host names in the events list, we'll join `availability_slots` with `user_profiles` on the `user_id` field. The existing RLS policy "Anyone can view availability slots" allows this query. However, `user_profiles` has an RLS policy limiting reads to own profile only.

**Solution**: We'll add a new RLS policy on `user_profiles` to allow reading `display_name` for hosts of public events. This ensures privacy while enabling the feature.

---

### No Breaking Changes
- All existing functionality remains intact
- Calendar still works the same way (click date to see slots)
- Event list is additive - provides an alternative discovery path
- ICS export is optional and non-intrusive


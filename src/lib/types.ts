export type BookingMode = 'fcfs' | 'lottery';

export interface AvailabilitySlot {
  id: string;
  date: string;
  time: string;
  end_time: string | null;
  total_tables: number;
  booked_tables: number;
  name: string;
  description: string | null;
  booking_mode: BookingMode;
  created_at: string;
}

export interface Booking {
  id: string;
  slot_id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  status: 'confirmed' | 'pending_lottery' | 'cancelled' | 'completed';
  created_at: string;
  availability_slots?: AvailabilitySlot;
}

export type ViewMode = 'customer' | 'admin';
export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'all';

export const MEAL_TIME_RANGES = {
  breakfast: { start: '06:00', end: '11:00' },
  lunch: { start: '11:00', end: '15:00' },
  dinner: { start: '17:00', end: '23:00' },
} as const;

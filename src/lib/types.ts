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
  user_id: string | null;
  waitlist_enabled: boolean;
  location?: string | null;
  estimated_cost_per_person?: number | null;
}

export interface Booking {
  id: string;
  slot_id: string;
  customer_name: string;
  customer_email: string;
  party_size: number;
  status: 'confirmed' | 'pending_lottery' | 'cancelled' | 'completed';
  created_at: string;
  dietary_restrictions?: string | null;
  availability_slots?: AvailabilitySlot;
}

export interface WaitlistEntry {
  id: string;
  slot_id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  party_size: number;
  position: number;
  created_at: string;
  notified_at: string | null;
  dietary_restrictions?: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  venmo_username: string | null;
  zelle_identifier: string | null;
  payment_sharing_consent: boolean;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ViewMode = 'customer' | 'admin';
export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'all';

export const MEAL_TIME_RANGES = {
  breakfast: { start: '06:00', end: '11:00' },
  lunch: { start: '11:00', end: '15:00' },
  dinner: { start: '17:00', end: '23:00' },
} as const;

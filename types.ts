
export interface BarberServiceOffer {
  serviceId: string;
  price: number;
  durationMinutes: number;
}

export interface Barber {
  id: string;
  name: string;
  tier: string; // e.g. "Junior", "Top Gun"
  description: string; // Short bio/specialization
  image: string;
  rating: number;
  services: BarberServiceOffer[];
  workDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  tags: string[]; // Vibe tags (e.g. "Silent", "Chatty")
}

export interface Service {
  id: string;
  name: string;
  description?: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface Booking {
  id: string;
  barberId: string;
  serviceId: string;
  date: string; // ISO date string
  timeSlot: string;
  clientName: string;
  clientPhone: string;
  price: number; // Store frozen price at time of booking
  duration: number;
  status: 'confirmed' | 'cancelled';
  createdAt: number;
  tgUserId?: string | number;
  tgUsername?: string;
}

export enum AppView {
  HOME = 'HOME',
  BOOKING = 'BOOKING',
  MY_BOOKINGS = 'MY_BOOKINGS',
}
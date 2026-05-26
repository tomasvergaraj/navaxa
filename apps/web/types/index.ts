import type {
  Tenant,
  User,
  Barber,
  Client,
  Service,
  Appointment,
  HaircutRecord,
  ClientPreference,
} from "@navaxa/db";

export type ClientWithDetails = Client & {
  preferences: ClientPreference | null;
  haircuts: HaircutRecord[];
};

export type AppointmentWithDetails = Appointment & {
  client: Client;
  barber: Barber & { user: User };
  services: { service: Service; priceCharged: number }[];
};

export type BarberWithUser = Barber & { user: User };

export type SafeUser = Omit<User, "passwordHash">;

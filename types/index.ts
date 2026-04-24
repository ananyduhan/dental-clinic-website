import type {
  User,
  Dentist,
  Availability,
  BlockedDate,
  Appointment,
  Service,
  Role,
  DayOfWeek,
  AppointmentStatus,
} from "@prisma/client";

export type { Role, DayOfWeek, AppointmentStatus };

// Re-export Prisma model types with relations for use across the app
export type UserWithDentist = User & {
  dentist: Dentist | null;
};

export type DentistWithUser = Dentist & {
  user: User;
  availability: Availability[];
  blockedDates: BlockedDate[];
};

export type DentistWithUserPublic = Dentist & {
  user: Pick<User, "id" | "firstName" | "lastName">;
};

export type AppointmentWithRelations = Appointment & {
  patient: Pick<User, "id" | "firstName" | "lastName" | "email" | "phone">;
  dentist: Dentist & {
    user: Pick<User, "id" | "firstName" | "lastName">;
  };
  service: Service;
};

// Slot types for booking flow
export interface TimeSlot {
  startTime: string; // "HH:mm" format
  endTime: string;   // "HH:mm" format
  available: boolean;
}

// Session user type extending NextAuth
export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
}

// API response shapes
export interface ApiSuccess<T = unknown> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Admin dashboard stats
export interface DashboardStats {
  todaysAppointments: number;
  totalPatients: number;
  pendingConfirmations: number;
  cancellationsThisWeek: number;
}

// Excel export row shape
export interface AppointmentExportRow {
  "Patient Name": string;
  "Patient Phone": string;
  Dentist: string;
  Service: string;
  Date: string;
  Time: string;
  Status: string;
  Notes: string;
}

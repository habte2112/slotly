export interface ServiceSummary {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface Service extends ServiceSummary {
  description: string | null;
}

export interface Provider {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  services: ServiceSummary[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
}

export interface Slot {
  start: string;
  end: string;
  label: string;
}

export interface Booking {
  id: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  notes: string | null;
  provider: { id: string; user: { name: string } };
  service: ServiceSummary;
}

const TOKEN_KEY = "slotly_token";

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ችላ በል */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ችላ በል */
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message ?? "Request failed", res.status);
  return data as T;
}

// ---- Auth ----
export interface AuthResponse {
  user: User;
  token: string;
}

export const login = (email: string, password: string) =>
  request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const register = (input: { name: string; email: string; phone?: string; password: string }) =>
  request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) });

export const getMe = () => request<{ user: User }>("/auth/me").then((r) => r.user);

// ---- Catalog ----
export const getServices = () => request<{ services: Service[] }>("/services").then((r) => r.services);

export const getProviders = (serviceId?: string) =>
  request<{ providers: Provider[] }>(`/providers${serviceId ? `?serviceId=${serviceId}` : ""}`).then(
    (r) => r.providers,
  );

export const getAvailability = (providerId: string, serviceId: string, date: string) =>
  request<{ slots: Slot[] }>(`/providers/${providerId}/availability?date=${date}&serviceId=${serviceId}`).then(
    (r) => r.slots,
  );

// ---- Bookings ----
export const createBooking = (input: { providerId: string; serviceId: string; startAt: string; notes?: string }) =>
  request<{ booking: Booking }>("/bookings", { method: "POST", body: JSON.stringify(input) }).then(
    (r) => r.booking,
  );

export const getMyBookings = () => request<{ bookings: Booking[] }>("/bookings/my").then((r) => r.bookings);

export const cancelBooking = (id: string) =>
  request<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: "PATCH" }).then((r) => r.booking);
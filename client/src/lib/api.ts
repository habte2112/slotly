import { translateServerError } from "../i18n/errors";
export interface ServiceSummary {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface Style {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  imageUrl: string | null;
}

export interface Service extends ServiceSummary {
  description: string | null;
  variants: Style[];
}

export interface ProviderStyle extends Style {
  serviceId: string;
}

export interface Provider {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  services: ServiceSummary[];
  variants: ProviderStyle[];
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
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  notes: string | null;
  priceAtBooking: number | null;
  provider: { id: string; user: { name: string } };
  service: ServiceSummary;
  variant: { id: string; name: string } | null;
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
  if (!res.ok) throw new ApiError(translateServerError(data.message ?? "Request failed"), res.status);
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

export const saveLocale = (locale: "en" | "am") =>
  request<{ locale: string }>("/auth/locale", { method: "PATCH", body: JSON.stringify({ locale }) });

// ---- Catalog ----
export const getServices = () => request<{ services: Service[] }>("/services").then((r) => r.services);

export const getProviders = (serviceId?: string, variantId?: string) => {
  const params = new URLSearchParams();
  if (serviceId) params.set("serviceId", serviceId);
  if (variantId) params.set("variantId", variantId);
  const query = params.toString();
  return request<{ providers: Provider[] }>(`/providers${query ? `?${query}` : ""}`).then((r) => r.providers);
};

export interface Availability {
  slots: Slot[];
  durationMinutes: number;
  price: number;
}

export const getAvailability = (providerId: string, serviceId: string, date: string, variantId?: string) =>
  request<Availability>(
    `/providers/${providerId}/availability?date=${date}&serviceId=${serviceId}${variantId ? `&variantId=${variantId}` : ""}`,
  );

// ---- Bookings ----
export const createBooking = (input: {
  providerId: string;
  serviceId: string;
  variantId?: string;
  startAt: string;
  notes?: string;
}) =>
  request<{ booking: Booking }>("/bookings", { method: "POST", body: JSON.stringify(input) }).then(
    (r) => r.booking,
  );

export const getMyBookings = () => request<{ bookings: Booking[] }>("/bookings/my").then((r) => r.bookings);

export const cancelBooking = (id: string) =>
  request<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: "PATCH" }).then((r) => r.booking);

// ---- Provider dashboard ----
export interface WorkingWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TimeOff {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

export interface ProviderBooking {
  id: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  notes: string | null;
  customer: { name: string; phone: string | null; noShows: number };
  service: { name: string; durationMinutes: number };
  variant: { name: string } | null;
  priceAtBooking: number | null;
}

export const getProviderMe = () =>
  request<{
    provider: { id: string; name: string; bio: string | null };
    workingHours: WorkingWindow[];
    timeOff: TimeOff[];
  }>("/provider/me");

export const saveWorkingHours = (windows: WorkingWindow[]) =>
  request<{ workingHours: WorkingWindow[] }>("/provider/working-hours", {
    method: "PUT",
    body: JSON.stringify({ windows }),
  });

export const addTimeOff = (input: { startAt: string; endAt: string; reason?: string }) =>
  request<{ timeOff: TimeOff }>("/provider/time-off", { method: "POST", body: JSON.stringify(input) }).then(
    (r) => r.timeOff,
  );

export const deleteTimeOff = (id: string) =>
  request<{ success: boolean }>(`/provider/time-off/${id}`, { method: "DELETE" });

export const getProviderBookings = (scope: "upcoming" | "past") =>
  request<{ bookings: ProviderBooking[] }>(`/provider/bookings?scope=${scope}`).then((r) => r.bookings);

export const updateProviderBookingStatus = (id: string, status: "COMPLETED" | "CANCELLED" | "NO_SHOW") =>
  request<{ booking: ProviderBooking }>(`/provider/bookings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }).then((r) => r.booking);

export const createManualBooking = (input: {
  customerName: string;
  customerPhone: string;
  serviceId: string;
  variantId?: string;
  startAt: string;
  notes?: string;
}) =>
  request<{ booking: ProviderBooking }>("/provider/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.booking);

  export const createAdminBooking = (input: {
  providerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  variantId?: string;
  startAt: string;
  notes?: string;
}) =>
  request<{ booking: ProviderBooking }>("/admin/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.booking);

// ---- Reschedule ----
export const getRescheduleSlots = (bookingId: string, date: string) =>
  request<{ slots: Slot[] }>(`/bookings/${bookingId}/availability?date=${date}`).then((r) => r.slots);

export const rescheduleBooking = (id: string, startAt: string) =>
  request<{ booking: Booking }>(`/bookings/${id}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify({ startAt }),
  }).then((r) => r.booking);

// ---- Password reset ----
export const forgotPassword = (email: string) =>
  request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });

export const resetPassword = (token: string, password: string) =>
  request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });

// ---- Admin ----
export interface AdminStats {
  days: number;
  from: string;
  to: string;
  truncated: boolean;
  totals: {
    bookings: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    revenue: number;
    cancellationRate: number;
    noShow: number;
    noShowRate: number;
  };
  upcoming: number;
  users: { customers: number; providers: number; admins: number };
  perDay: { date: string; bookings: number; cancelled: number }[];
  topServices: { id: string; name: string; bookings: number; revenue: number }[];
}

export const getAdminStats = (days: number) => request<AdminStats>(`/admin/stats?days=${days}`);

export interface AdminBooking {
  id: string;
  startAt: string;
  endAt: string;
  status: Booking["status"];
  customer: { name: string; email: string; phone: string | null; isGuest: boolean };
  provider: { user: { name: string } };
  service: { name: string };
  variant: { name: string } | null;
  priceAtBooking: number | null;
}

export const getAdminBookings = (scope: "upcoming" | "past") =>
  request<{ bookings: AdminBooking[] }>(`/admin/bookings?scope=${scope}`).then((r) => r.bookings);

export interface AdminStyle extends Style {
  serviceId: string;
  isActive: boolean;
  sortOrder: number;
}

export interface AdminService extends ServiceSummary {
  description: string | null;
  isActive: boolean;
  variants: AdminStyle[];
}

export const getAdminServices = () =>
  request<{ services: AdminService[] }>("/admin/services").then((r) => r.services);

export const createService = (input: {
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
}) =>
  request<{ service: Omit<AdminService, "variants"> }>("/services", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => ({ ...r.service, variants: [] as AdminStyle[] }));

export const updateService = (id: string, patch: { isActive?: boolean }) =>
  request<{ service: AdminService }>(`/services/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(
    (r) => r.service,
  );

export const createStyle = (
  serviceId: string,
  input: { name: string; description?: string; durationMinutes: number; price: number }
) =>
  request<{ variant: AdminStyle; assignedTo: number }>(`/admin/services/${serviceId}/variants`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateStyle = (
  id: string,
  patch: { isActive?: boolean; price?: number; durationMinutes?: number; name?: string; description?: string }
) =>
  request<{ variant: AdminStyle }>(`/admin/variants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.variant);

  // ---- Style images (Cloudinary signed upload) ----
interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  allowedFormats: string;
  signature: string;
}

export const setStyleImage = (id: string, imageUrl: string | null) =>
  request<{ id: string; imageUrl: string | null }>(`/admin/variants/${id}/image`, {
    method: "PUT",
    body: JSON.stringify({ imageUrl }),
  });

export async function uploadStyleImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("JPG, PNG or WebP only");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Image must be under 2 MB");
  }
  const s = await request<UploadSignature>("/admin/uploads/sign", { method: "POST" });

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", s.apiKey);
  form.append("timestamp", String(s.timestamp));
  form.append("signature", s.signature);
  form.append("folder", s.folder);
  form.append("allowed_formats", s.allowedFormats);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
  return data.secure_url as string;
}

export interface AdminProvider {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  services: { id: string; name: string }[];
  variants: {
    variantId: string;
    priceOverride: number | null;
    durationOverride: number | null;
  }[];
}

export const getAdminProviders = () =>
  request<{ providers: AdminProvider[] }>("/admin/providers").then((r) => r.providers);

export const createProviderByEmail = (email: string, bio?: string) =>
  request<{ provider: { id: string } }>("/admin/providers", {
    method: "POST",
    body: JSON.stringify({ email, bio }),
  });

export const setProviderServices = (id: string, serviceIds: string[]) =>
  request<{ provider: { id: string } }>(`/providers/${id}/services`, {
    method: "PUT",
    body: JSON.stringify({ serviceIds }),
  });

export const setProviderStyles = (
  providerId: string,
  variants: { variantId: string; priceOverride: number | null; durationOverride: number | null }[]
) =>
  request<{ variants: AdminProvider["variants"] }>(`/admin/providers/${providerId}/variants`, {
    method: "PUT",
    body: JSON.stringify({ variants }),
  });

// ---- Telegram ----
export interface TelegramStatus {
  enabled: boolean;
  linked: boolean;
  botUsername: string | null;
}

export const getTelegramStatus = () => request<TelegramStatus>("/telegram/status");

export const createTelegramLink = () =>
  request<{ url: string }>("/telegram/link", { method: "POST" }).then((r) => r.url);

export const unlinkTelegram = () => request<{ success: boolean }>("/telegram/link", { method: "DELETE" });

// ---- Reviews ----
export interface RatingInfo {
  average: number;
  count: number;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: string;
}

export const getProviderReviews = (providerId: string) =>
  request<{ summary: RatingInfo; reviews: Review[] }>(`/providers/${providerId}/reviews`);

export const getRatingsSummary = () =>
  request<{ ratings: { providerId: string; average: number; count: number }[] }>("/reviews/summary").then(
    (r) => {
      const map: Record<string, RatingInfo> = {};
      for (const x of r.ratings) map[x.providerId] = { average: x.average, count: x.count };
      return map;
    },
  );

export const getMyReviewedBookingIds = () =>
  request<{ bookingIds: string[] }>("/reviews/mine").then((r) => r.bookingIds);

export const createReview = (bookingId: string, rating: number, comment?: string) =>
  request<{ review: { id: string } }>(`/bookings/${bookingId}/review`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  customer: { name: string; email: string };
  provider: { user: { name: string } };
}

export const getAdminReviews = () =>
  request<{ reviews: AdminReview[] }>("/admin/reviews").then((r) => r.reviews);

export const setReviewHidden = (id: string, isHidden: boolean) =>
  request<{ review: { id: string; isHidden: boolean } }>(`/admin/reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ isHidden }),
  });
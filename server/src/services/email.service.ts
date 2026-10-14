
import { Resend } from "resend";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { buildIcs, googleCalendarUrl } from "./calendar";

export type BookingEmailKind =
  | "confirmed"
  | "rescheduled"
  | "cancelled_by_customer"
  | "cancelled_by_provider"
  | "reminder";

const resend = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : null;

export const emailEnabled = resend !== null;

const whenFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Addis_Ababa",
  dateStyle: "full",
  timeStyle: "short",
});

interface BookingForEmail {
  id: string;
  startAt: Date;
  endAt: Date;
  priceAtBooking: number | null;
  customer: {
    name: string;
    email: string;
  };
  provider: {
    user: {
      name: string;
    };
  };
  service: {
    name: string;
    durationMinutes: number;
    price: number;
  };
}

// Load the booking and the related information needed for emails.
async function loadBooking(
  bookingId: string
): Promise<BookingForEmail | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      priceAtBooking: true,
      customer: {
        select: {
          name: true,
          email: true,
        },
      },
      provider: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      service: {
        select: {
          name: true,
          durationMinutes: true,
          price: true,
        },
      },
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function describe(
  kind: BookingEmailKind,
  b: BookingForEmail
): { subject: string; heading: string; intro: string } {
  const when = whenFormat.format(b.startAt);

  switch (kind) {
    case "confirmed":
      return {
        subject: `Booking confirmed: ${b.service.name}`,
        heading: "Your booking is confirmed",
        intro:
          "Thank you for booking with Slotly. Here are your appointment details.",
      };

    case "rescheduled":
      return {
        subject: `Booking rescheduled: ${b.service.name}`,
        heading: "Your booking was rescheduled",
        intro:
          "Your appointment has been moved to the new time below.",
      };

    case "cancelled_by_customer":
      return {
        subject: `Booking cancelled: ${b.service.name}`,
        heading: "Your booking was cancelled",
        intro:
          "You cancelled this appointment. We hope to see you again soon.",
      };

    case "cancelled_by_provider":
      return {
        subject: `Booking cancelled: ${b.service.name}`,
        heading: "Your booking was cancelled",
        intro:
          "Unfortunately the service provider had to cancel this appointment. Please book another time.",
      };

    case "reminder":
      return {
        subject: `Reminder: ${b.service.name} on ${when}`,
        heading: "Your appointment is coming up",
        intro:
          "This is a friendly reminder about your upcoming appointment.",
      };
  }
}

function details(b: BookingForEmail): [string, string][] {
  return [
    ["Service", b.service.name],
    ["Specialist", b.provider.user.name],
    [
      "When",
      `${whenFormat.format(b.startAt)} (Addis Ababa time)`,
    ],
    ["Duration", `${b.service.durationMinutes} min`],
    [
      "Price",
      `${b.priceAtBooking ?? b.service.price} ETB`,
    ],
  ];
}

function renderHtml(
  heading: string,
  intro: string,
  b: BookingForEmail,
  calendarUrl?: string
): string {
  const rows = details(b)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6b7280">${escapeHtml(k)}</td>` +
        `<td style="padding:6px 0;color:#111827"><strong>${escapeHtml(v)}</strong></td></tr>`
    )
    .join("");

  const calendar = calendarUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(calendarUrl)}" style="color:#111827">Add to Google Calendar</a>` +
      ` <span style="color:#6b7280">(an .ics file for Apple or Outlook is attached)</span></p>`
    : "";

  return `<!doctype html>
<html>
<body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
    <p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#111827">Slotly</p>
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px;color:#374151">Hi ${escapeHtml(b.customer.name)}, ${escapeHtml(intro)}</p>
    <table style="border-collapse:collapse;font-size:14px">${rows}</table>
    ${calendar}
    <p style="margin:24px 0 0"><a href="${escapeHtml(env.APP_URL)}/my-bookings" style="color:#111827">View my bookings</a></p>
  </div>
</body>
</html>`;
}

function renderText(
  heading: string,
  intro: string,
  b: BookingForEmail,
  calendarUrl?: string
): string {
  const lines = details(b).map(
    ([k, v]) => `${k}: ${v}`
  );

  return [
    heading,
    "",
    `Hi ${b.customer.name}, ${intro}`,
    "",
    ...lines,
    ...(calendarUrl
      ? ["", `Add to calendar: ${calendarUrl}`]
      : []),
    "",
    `${env.APP_URL}/my-bookings`,
  ].join("\n");
}

// Never throw; return success as a boolean.
export async function sendBookingEmail(
  kind: BookingEmailKind,
  bookingId: string
): Promise<boolean> {
  try {
    if (!resend) {
      console.log(
        `[email] skipped (RESEND_API_KEY not set): ${kind} for booking ${bookingId}`
      );
      return false;
    }

    const booking = await loadBooking(bookingId);

    if (!booking) {
      console.error(
        `[email] booking not found: ${bookingId}`
      );
      return false;
    }

    const { subject, heading, intro } = describe(
      kind,
      booking
    );

    const withCalendar =
      kind === "confirmed" || kind === "rescheduled";

    const event = {
      id: booking.id,
      startAt: booking.startAt,
      endAt: booking.endAt,
      title: `${booking.service.name} with ${booking.provider.user.name}`,
      description: "Booked on Slotly",
    };

    const calendarUrl = withCalendar
      ? googleCalendarUrl(event)
      : undefined;

    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: booking.customer.email,
      subject,
      html: renderHtml(
        heading,
        intro,
        booking,
        calendarUrl
      ),
      text: renderText(
        heading,
        intro,
        booking,
        calendarUrl
      ),
      ...(withCalendar
        ? {
            attachments: [
              {
                filename: "booking.ics",
                content: Buffer.from(
                  buildIcs(event),
                  "utf-8"
                ),
              },
            ],
          }
        : {}),
    });

    if (error) {
      console.error(
        `[email] ${kind} failed for booking ${bookingId}: ${error.message}`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(
      `[email] ${kind} crashed for booking ${bookingId}:`,
      err
    );
    return false;
  }
}

// Send the email without waiting; email failure does not break the booking flow.
export function notifyBooking(
  kind: BookingEmailKind,
  bookingId: string
): void {
  void sendBookingEmail(kind, bookingId);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function processReminders(
  minAgeMinutes = 120,
  now = new Date()
) {
  if (!emailEnabled) {
    return {
      due: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      emailEnabled: false,
    };
  }

  const due = await prisma.booking.findMany({
    where: {
      status: {
        in: ["PENDING", "CONFIRMED"],
      },
      reminderSentAt: null,
      startAt: {
        gt: now,
        lte: new Date(now.getTime() + DAY_MS),
      },
      // Prevent reminders immediately after a booking is created.
      createdAt: {
        lt: new Date(
          now.getTime() - minAgeMinutes * 60 * 1000
        ),
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      id: true,
    },
    take: 50,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { id } of due) {
    // Claim the reminder before sending to reduce duplicate emails.
    const claim = await prisma.booking.updateMany({
      where: {
        id,
        reminderSentAt: null,
      },
      data: {
        reminderSentAt: now,
      },
    });

    if (claim.count === 0) {
      skipped++;
      continue;
    }

    if (await sendBookingEmail("reminder", id)) {
      sent++;
    } else {
      failed++;
      // A failed reminder is not retried by this implementation.
    }
  }

  return {
    due: due.length,
    sent,
    failed,
    skipped,
    emailEnabled: true,
  };
}

// Do not print the token or reset link in logs.
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<boolean> {
  try {
    if (!resend) {
      console.log(
        "[email] skipped (RESEND_API_KEY not set): password reset"
      );
      return false;
    }

    const link =
      `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

    const html = `<!doctype html>
<html>
<body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
    <p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#111827">Slotly</p>
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">Reset your password</h1>
    <p style="margin:0 0 16px;color:#374151">Hi ${escapeHtml(name)}, we received a request to reset your password. This link works once and expires in 1 hour.</p>
    <p style="margin:0 0 16px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none">Choose a new password</a></p>
    <p style="margin:0;color:#6b7280;font-size:13px">If you did not ask for this, you can ignore this email; your password will not change.</p>
  </div>
</body>
</html>`;

    const text = [
      `Hi ${name},`,
      "",
      "We received a request to reset your Slotly password. This link works once and expires in 1 hour:",
      link,
      "",
      "If you did not ask for this, ignore this email.",
    ].join("\n");

    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: "Reset your Slotly password",
      html,
      text,
    });

    if (error) {
      console.error(
        `[email] password reset failed: ${error.message}`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(
      "[email] password reset crashed:",
      err
    );
    return false;
  }
}

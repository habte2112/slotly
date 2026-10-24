export type Locale = "en" | "am";

export const asLocale = (value: string | null | undefined): Locale => (value === "am" ? "am" : "en");

const en = {
  "heading.confirmed": "✅ <b>Booking confirmed</b>",
  "heading.rescheduled": "🔄 <b>Booking rescheduled</b>",
  "heading.cancelled_by_customer": "❌ <b>Booking cancelled</b>",
  "heading.cancelled_by_provider": "❌ <b>Booking cancelled by the provider</b>",
  "heading.reminder": "⏰ <b>Reminder: your appointment is coming up</b>",
  "provider.confirmed": "🆕 <b>New booking</b>",
  "provider.rescheduled": "🔄 <b>Booking moved</b>",
  "provider.cancelled_by_customer": "❌ <b>The customer cancelled</b>",
  "booking.title": "{service} with {provider}",
  "booking.price": "{price} ETB",
  "btn.calendar": "Add to Google Calendar",
  "btn.myBookings": "My bookings",
  "cal.description": "Booked on Slotly",

  "outcome.title": "🕑 <b>Did the customer come?</b>",
  "btn.came": "✅ Came",
  "btn.noShow": "❌ No-show",

  "bot.welcome":
    "👋 Hi! I am the Slotly booking bot.\n\nTo connect this chat to your account, open Slotly → My bookings → Connect Telegram, then tap the link there.",
  "bot.help":
    "<b>Slotly bot</b>\n\n/bookings - your upcoming appointments\n/cancel - cancel an appointment\n/today - today's appointments (specialists)\n/unlink - stop notifications in this chat\n/help - show this message",
  "bot.notLinked":
    "This chat is not connected to a Slotly account yet.\n\nOpen Slotly → My bookings → Connect Telegram, then tap the link there.",
  "bot.invalidLink":
    "That link is invalid or has expired. Open Slotly → My bookings → Connect Telegram to get a new one.",
  "bot.unknown": "I did not understand that. Send /help to see what I can do.",
  "bot.connected":
    "✅ <b>Connected</b>\n\nHi {name}! You will now get your booking updates here.\n\nTry /bookings or send /help.",
  "bot.disconnected": "Disconnected. You will no longer get notifications in this chat.",
  "bot.noUpcoming": "You have no upcoming bookings.",
  "bot.bookingLine": "<b>{service}</b> with {provider}\n📅 {when}",
  "bot.upcomingList": "<b>Your upcoming bookings</b>\n\n{lines}\n\nSend /cancel to cancel one.",
  "bot.noneToCancel": "You have no upcoming bookings to cancel.",
  "bot.cancelWhich": "Which booking do you want to cancel?",
  "bot.kept": "Okay, your booking is kept.",
  "bot.cancelUnavailable": "I could not find that booking, or it can no longer be cancelled.",
  "bot.cancelConfirm": "Cancel <b>{service}</b> on {when}?",
  "btn.yesCancel": "Yes, cancel it",
  "btn.keep": "Keep it",
  "bot.specialistsOnly": "This command is for specialists.",
  "bot.noToday": "No appointments today.",
  "bot.today": "<b>Today</b>\n\n{lines}",
  "bot.notFound": "I could not find that booking.",
  "bot.alreadyAs": "Already recorded as {status}.",
  "bot.notStarted": "This appointment has not started yet.",
  "bot.already": "Already recorded.",
  "bot.markedCompleted": "✅ Marked as completed.",
  "bot.markedNoShowOne": "❌ Marked as no-show. {name} now has {count} no-show.",
  "bot.markedNoShowMany": "❌ Marked as no-show. {name} now has {count} no-shows.",

  "status.COMPLETED": "completed",
  "status.NO_SHOW": "no-show",
  "status.CANCELLED": "cancelled",
} as const;

export type MessageKey = keyof typeof en;

const am: Record<MessageKey, string> = {
  "heading.confirmed": "✅ <b>ቀጠሮዎ ተረጋግጧል</b>",
  "heading.rescheduled": "🔄 <b>ቀጠሮዎ ተቀይሯል</b>",
  "heading.cancelled_by_customer": "❌ <b>ቀጠሮው ተሰርዟል</b>",
  "heading.cancelled_by_provider": "❌ <b>ቀጠሮው በባለሙያው ተሰርዟል</b>",
  "heading.reminder": "⏰ <b>አስታዋሽ፦ ቀጠሮዎ ቀርቧል</b>",
  "provider.confirmed": "🆕 <b>አዲስ ቀጠሮ</b>",
  "provider.rescheduled": "🔄 <b>ቀጠሮ ተዛውሯል</b>",
  "provider.cancelled_by_customer": "❌ <b>ደንበኛው ቀጠሮውን ሰርዟል</b>",
  "booking.title": "{service} ከ{provider} ጋር",
  "booking.price": "{price} ብር",
  "btn.calendar": "ወደ Google Calendar ጨምር",
  "btn.myBookings": "ቀጠሮዎቼ",
  "cal.description": "በSlotly የተያዘ",

  "outcome.title": "🕑 <b>ደንበኛው መጥተዋል?</b>",
  "btn.came": "✅ መጥተዋል",
  "btn.noShow": "❌ አልመጡም",

  "bot.welcome":
    "👋 ሰላም! እኔ የSlotly የቀጠሮ ቦት ነኝ።\n\nይህን ውይይት ከአካውንትዎ ጋር ለማገናኘት Slotly → ቀጠሮዎቼ → ቴሌግራምን አገናኝ ይክፈቱና እዚያ ያለውን አገናኝ ይጫኑ።",
  "bot.help":
    "<b>Slotly ቦት</b>\n\n/bookings - የሚመጡ ቀጠሮዎችዎ\n/cancel - ቀጠሮ ለመሰረዝ\n/today - የዛሬ ቀጠሮዎች (ለባለሙያዎች)\n/unlink - በዚህ ውይይት ማሳወቂያ ለማቆም\n/help - ይህን መልዕክት ለማሳየት",
  "bot.notLinked":
    "ይህ ውይይት ከSlotly አካውንት ጋር ገና አልተገናኘም።\n\nSlotly → ቀጠሮዎቼ → ቴሌግራምን አገናኝ ይክፈቱና እዚያ ያለውን አገናኝ ይጫኑ።",
  "bot.invalidLink":
    "አገናኙ ልክ አይደለም ወይም ጊዜው አልፎበታል። አዲስ ለማግኘት Slotly → ቀጠሮዎቼ → ቴሌግራምን አገናኝ ይክፈቱ።",
  "bot.unknown": "ይህን አልገባኝም። የምችለውን ለማየት /help ይላኩ።",
  "bot.connected":
    "✅ <b>ተገናኝቷል</b>\n\nሰላም {name}! ከአሁን በኋላ የቀጠሮ ማሳወቂያዎችዎ እዚህ ይደርሱዎታል።\n\n/bookings ይሞክሩ ወይም /help ይላኩ።",
  "bot.disconnected": "ግንኙነቱ ተቋርጧል። ከአሁን በኋላ በዚህ ውይይት ማሳወቂያ አይደርስዎትም።",
  "bot.noUpcoming": "የሚመጣ ቀጠሮ የለዎትም።",
  "bot.bookingLine": "<b>{service}</b> ከ{provider} ጋር\n📅 {when}",
  "bot.upcomingList": "<b>የሚመጡ ቀጠሮዎችዎ</b>\n\n{lines}\n\nአንዱን ለመሰረዝ /cancel ይላኩ።",
  "bot.noneToCancel": "የሚሰርዙት የሚመጣ ቀጠሮ የለዎትም።",
  "bot.cancelWhich": "የትኛውን ቀጠሮ መሰረዝ ይፈልጋሉ?",
  "bot.kept": "እሺ፣ ቀጠሮዎ እንዳለ ነው።",
  "bot.cancelUnavailable": "ቀጠሮውን አላገኘሁትም፤ ወይም ከዚህ በኋላ መሰረዝ አይቻልም።",
  "bot.cancelConfirm": "<b>{service}</b> ቀጠሮ ({when}) ይሰረዝ?",
  "btn.yesCancel": "አዎ፣ ሰርዝ",
  "btn.keep": "እንዳለ ይቆይ",
  "bot.specialistsOnly": "ይህ ትዕዛዝ ለባለሙያዎች ነው።",
  "bot.noToday": "ዛሬ ምንም ቀጠሮ የለም።",
  "bot.today": "<b>ዛሬ</b>\n\n{lines}",
  "bot.notFound": "ቀጠሮውን አላገኘሁትም።",
  "bot.alreadyAs": "አስቀድሞ ተመዝግቧል፦ {status}።",
  "bot.notStarted": "ይህ ቀጠሮ ገና አልጀመረም።",
  "bot.already": "አስቀድሞ ተመዝግቧል።",
  "bot.markedCompleted": "✅ እንደተጠናቀቀ ተመዝግቧል።",
  "bot.markedNoShowOne": "❌ እንዳልመጡ ተመዝግቧል። {name} አሁን {count} ጊዜ አልመጡም።",
  "bot.markedNoShowMany": "❌ እንዳልመጡ ተመዝግቧል። {name} አሁን {count} ጊዜ አልመጡም።",

  "status.COMPLETED": "ተጠናቋል",
  "status.NO_SHOW": "አልመጡም",
  "status.CANCELLED": "ተሰርዟል",
};

export const MESSAGES = { en, am };

// ቁልፎቹ በአንድ ጊዜ ነው የሚተኩት፣ ስለዚህ በስም ውስጥ ያለ "{...}" በስህተት አይተካም
export function tg(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const text: string = MESSAGES[locale][key] ?? MESSAGES.en[key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

const TZ = "Africa/Addis_Ababa";

// እንግሊዝኛ፦ ቅርጸቶቹ እንደበፊቱ ናቸው
const FORMATS = {
  full: { dateStyle: "full", timeStyle: "short" },
  long: { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false },
  short: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false },
  time: { hour: "2-digit", minute: "2-digit", hour12: false },
} as const;

export type FormatName = keyof typeof FORMATS;

// አማርኛ፦ ቀኑ ለብቻ፣ ሰዓቱ በ24 ሰዓት ከኢትዮጵያ ሰዓት ጋር
const DATE_PART = {
  full: { dateStyle: "full" },
  long: { weekday: "long", day: "numeric", month: "long" },
  short: { weekday: "short", day: "numeric", month: "short" },
} as const;
const CLOCK = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(intlLocale: string, id: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${intlLocale}:${id}`;
  let found = cache.get(cacheKey);
  if (!found) {
    found = new Intl.DateTimeFormat(intlLocale, { timeZone: TZ, ...options });
    cache.set(cacheKey, found);
  }
  return found;
}

// "HH:MM" (24 ሰዓት) → የኢትዮጵያ ሰዓት አቆጣጠር (የ6 ሰዓት ልዩነት)፤ 10:00 → "ጠዋት 4 ሰዓት"
export function ethiopianTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = (h + 6) % 12 || 12;
  const period = h >= 6 && h < 12 ? "ጠዋት" : h >= 12 && h < 18 ? "ቀን" : h >= 18 ? "ማታ" : "ሌሊት";
  return `${period} ${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ሰዓት`;
}

export function formatWhen(locale: Locale, name: FormatName, date: Date): string {
  if (locale === "en") return formatter("en-GB", name, FORMATS[name]).format(date);

  const clock = formatter("am-ET", "clock", CLOCK).format(date);
  const withLocal = `${clock} (${ethiopianTime(clock)})`;
  if (name === "time") return withLocal;
  return `${formatter("am-ET", name, DATE_PART[name]).format(date)}፣ ${withLocal}`;
}
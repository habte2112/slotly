import { config } from "dotenv";

config({ quiet: true });

const live = process.env.DATABASE_URL;
const test = process.env.TEST_DATABASE_URL;

if (test && live && test === live) {
  throw new Error("TEST_DATABASE_URL must be different from DATABASE_URL. Refusing to test your real database.");
}

// ሙከራዎች የሚጠቀሙት የሙከራ ዳታቤዝን ብቻ ነው
process.env.DATABASE_URL = test ?? "postgresql://unused:unused@127.0.0.1:1/unused";
process.env.JWT_SECRET = "test-jwt-secret-test-jwt-secret-1234";
process.env.CRON_SECRET = "test-cron-secret-test-cron-secret-12";
process.env.RESEND_API_KEY = ""; // ኢሜይል በሙከራ አይላክም
// Telegram በሐሰተኛ ዋጋዎች ይበራል፤ ወደ api.telegram.org የሚሄድ ጥሪ ሁሉ በሙከራዎች ውስጥ ይመሰላል
process.env.TELEGRAM_BOT_TOKEN = "123456789:TEST_TOKEN_FOR_SLOTLY_TESTS";
process.env.TELEGRAM_BOT_USERNAME = "slotly_test_bot";
process.env.TELEGRAM_WEBHOOK_SECRET = "test-webhook-secret-test-webhook-secret-0123";
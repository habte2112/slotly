import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.argv[2];

async function call(method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!data.ok) throw new Error(`${method} failed: ${data.description ?? "unknown error"}`);
  return data.result;
}

async function main() {
  if (!token || !secret) {
    console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in server/.env first.");
    process.exit(1);
  }
  if (!url || !url.startsWith("https://")) {
    console.error("Usage: npx tsx scripts/set-telegram-webhook.ts https://<your-api-host>/api/telegram/webhook");
    process.exit(1);
  }

  await call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await call("setMyCommands", {
    commands: [
      { command: "bookings", description: "Your upcoming appointments" },
      { command: "cancel", description: "Cancel an appointment" },
      { command: "unlink", description: "Stop notifications in this chat" },
      { command: "help", description: "What this bot can do" },
    ],
  });

  const info = (await call("getWebhookInfo")) as {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  };
  console.log("Webhook:", info.url);
  console.log("Pending updates:", info.pending_update_count ?? 0);
  console.log("Last error:", info.last_error_message ?? "none");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
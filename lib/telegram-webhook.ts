import { env } from "cloudflare:workers";

const webhookUrl = "https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site/api/telegram/webhook";
let lastChecked = 0;

type TelegramResult<T> = { ok: boolean; result?: T; description?: string };
type WebhookInfo = { allowed_updates?: string[] };

export async function ensureCallbackUpdates() {
  if (Date.now() - lastChecked < 60 * 60_000) return;
  const token = env.TELEGRAM_BOT_TOKEN;
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return;

  const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoResponse.json() as TelegramResult<WebhookInfo>;
  if (!infoResponse.ok || !info.ok || !info.result) throw new Error("Could not inspect Telegram webhook");
  const allowed = info.result.allowed_updates;
  if (allowed?.length && !allowed.includes("callback_query")) {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: [...new Set([...allowed, "callback_query"])] }),
    });
    const result = await response.json() as TelegramResult<boolean>;
    if (!response.ok || !result.ok) throw new Error(`Could not enable Telegram callback updates: ${result.description ?? response.status}`);
  }
  lastChecked = Date.now();
}

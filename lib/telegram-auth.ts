import { env } from "cloudflare:workers";
import { verifyTelegramInitData } from "./verify-telegram";

const TELEGRAM_PUBLIC_KEY = "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";

export async function telegramUserId(request: Request): Promise<string> {
  const botId = env.TELEGRAM_BOT_ID;
  if (!botId || !/^\d+$/.test(botId)) throw new Error("Бот ещё не подключён");
  return verifyTelegramInitData(request.headers.get("x-telegram-init-data"), botId, TELEGRAM_PUBLIC_KEY);
}

export function telegramError(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Ошибка входа" }, { status: 401 });
}

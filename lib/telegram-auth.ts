import { env } from "cloudflare:workers";
import { verifyTelegramInitData } from "./verify-telegram";
import { sessionUserId } from "./telegram-session";

const TELEGRAM_PUBLIC_KEY = "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d";

export async function telegramUserId(request: Request): Promise<string> {
  const botId = env.TELEGRAM_BOT_ID;
  if (!botId || !/^\d+$/.test(botId)) throw new Error("Бот ещё не подключён");
  const initData = request.headers.get("x-telegram-init-data");
  if (initData) return verifyTelegramInitData(initData, botId, TELEGRAM_PUBLIC_KEY);
  const token = env.TELEGRAM_BOT_TOKEN;
  const session = token ? await sessionUserId(request, token) : null;
  if (session) return session;
  throw new Error("Войдите через Telegram");
}

export function telegramError(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Ошибка входа" }, { status: 401 });
}

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { reminderSettings } from "../../../../db/schema";
import { listTasks } from "../../../../lib/tasks";

const appUrl = "https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site";

function sameSecret(received: string, expected: string) {
  let mismatch = received.length ^ expected.length;
  for (let index = 0; index < Math.max(received.length, expected.length); index++) mismatch |= (received.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  return mismatch === 0;
}

type Chat = { id?: number; type?: string };
type Update = {
  message?: { text?: string; from?: { id?: number }; chat?: Chat };
  callback_query?: { id?: string; data?: string; from?: { id?: number }; message?: { message_id?: number; chat?: Chat } };
};
type Setting = typeof reminderSettings.$inferSelect;
const keyboard = { keyboard: [[{ text: "Открыть задачи", web_app: { url: appUrl } }, { text: "Настроить" }], [{ text: "Ближайшие сроки" }]], resize_keyboard: true, is_persistent: true };
const leadOptions = [[5, "5 мин"], [15, "15 мин"], [30, "30 мин"], [60, "1 час"], [180, "3 часа"], [1440, "1 день"]] as const;

function send(chatId: number, text: string, replyMarkup: object = keyboard) {
  return Response.json({ method: "sendMessage", chat_id: chatId, text, reply_markup: replyMarkup });
}

async function getSetting(userId: string) {
  const [setting] = await getDb().select().from(reminderSettings).where(eq(reminderSettings.userId, userId));
  return setting;
}

function settingsMarkup(setting?: Setting) {
  const scopeButton = (label: string, scope: Setting["scope"]) => ({ text: `${setting?.scope === scope ? "✓ " : ""}${label}`, callback_data: `reminders:scope:${scope}` });
  const leadButton = ([minutes, label]: typeof leadOptions[number]) => ({ text: `${setting?.leadMinutes === minutes ? "✓ " : ""}За ${label}`, callback_data: `reminders:lead:${minutes}` });
  return { inline_keyboard: [
    [scopeButton("Все", "all"), scopeButton("Срочные", "urgent"), scopeButton("Выкл.", "off")],
    leadOptions.slice(0, 3).map(leadButton),
    leadOptions.slice(3).map(leadButton),
    [{ text: "Открыть задачи", web_app: { url: appUrl } }],
  ] };
}

function settingsText(setting?: Setting) {
  if (!setting) return "Напоминания\n\nПока действуют прежние напоминания. Выберите задачи и время до срока.";
  const scope = { all: "Все задачи", urgent: "Только срочные", off: "Выключены" }[setting.scope];
  const lead = leadOptions.find(([minutes]) => minutes === setting.leadMinutes)?.[1] ?? "1 час";
  return `Напоминания\n\nЗадачи: ${scope}\nКогда: за ${lead} до срока`;
}

async function settingsMessage(chatId: number, userId: string, messageId?: number) {
  const setting = await getSetting(userId);
  return Response.json({ method: messageId ? "editMessageText" : "sendMessage", chat_id: chatId, ...(messageId ? { message_id: messageId } : {}), text: settingsText(setting), reply_markup: settingsMarkup(setting) });
}

async function answerCallback(id: string, text?: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: id, ...(text ? { text } : {}) }) });
  } catch { /* The edited message still shows the saved setting. */ }
}

export async function POST(request: Request) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !sameSecret(received, expected)) return new Response(null, { status: 403 });
  const update = await request.json().catch(() => ({})) as Update;
  const callback = update.callback_query;
  if (callback?.id && callback.from?.id && callback.message?.chat?.type === "private" && callback.message.chat.id === callback.from.id && callback.message.message_id) {
    const userId = `tg:${callback.from.id}`;
    const data = callback.data ?? "";
    if (data === "reminders:show" || /^reminders:(scope:(all|urgent|off)|lead:(5|15|30|60|180|1440))$/.test(data)) {
      try {
        if (data !== "reminders:show") {
          const old = await getSetting(userId);
          const [, kind, value] = data.split(":");
          const scope = kind === "scope" ? value as Setting["scope"] : old?.scope === "off" ? "all" : old?.scope ?? "all";
          const leadMinutes = kind === "lead" ? Number(value) : old?.leadMinutes ?? 60;
          await getDb().insert(reminderSettings).values({ userId, scope, leadMinutes, updatedAt: new Date().toISOString() })
            .onConflictDoUpdate({ target: reminderSettings.userId, set: { scope, leadMinutes, updatedAt: new Date().toISOString() } });
        }
        await answerCallback(callback.id);
        return settingsMessage(callback.message.chat.id, userId, callback.message.message_id);
      } catch {
        await answerCallback(callback.id, "Не удалось сохранить. Попробуйте ещё раз.");
        return new Response(null, { status: 200 });
      }
    }
    await answerCallback(callback.id);
    return new Response(null, { status: 200 });
  }
  const message = update.message;
  if (message?.chat?.type !== "private" || !message.chat.id || !message.from?.id) return new Response(null, { status: 200 });
  const command = message.text?.trim() ?? "";
  if (/^\/(start|help)(?:@\w+)?(?:\s|$)/.test(command)) return send(message.chat.id, "Открыть задачи или настроить напоминания можно кнопками ниже.");
  if (command === "Настроить" || /^\/settings(?:@\w+)?(?:\s|$)/.test(command)) {
    try { return await settingsMessage(message.chat.id, `tg:${message.from.id}`); }
    catch { return send(message.chat.id, "Не удалось открыть настройки. Попробуйте ещё раз."); }
  }
  if (command === "Ближайшие сроки" || /^\/deadlines(?:@\w+)?(?:\s|$)/.test(command)) {
    try {
      const tasks = (await listTasks(`tg:${message.from.id}`)).filter(task => !task.completed && task.dueDate)
        .sort((a, b) => `${a.dueDate}T${a.dueTime ?? "99:99"}`.localeCompare(`${b.dueDate}T${b.dueTime ?? "99:99"}`) || a.priority - b.priority)
        .slice(0, 8);
      if (!tasks.length) return send(message.chat.id, "Задач со сроком нет.");
      const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const lines = tasks.map(task => {
        const date = task.dueDate!;
        const label = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
        return `${date < today ? "Просрочено · " : ""}${label}${task.dueTime ? `, ${task.dueTime}` : ""} — ${task.title}`;
      });
      return send(message.chat.id, `Ближайшие сроки:\n\n${lines.join("\n")}`);
    } catch { return send(message.chat.id, "Не удалось загрузить сроки. Попробуйте ещё раз."); }
  }
  if (command === "Задачи") return send(message.chat.id, "Задачи", { inline_keyboard: [[{ text: "Открыть задачи", web_app: { url: appUrl } }, { text: "Настроить", callback_data: "reminders:show" }]] });
  return new Response(null, { status: 200 });
}

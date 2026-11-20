import { env } from "cloudflare:workers";
import { listTasks } from "../../../../lib/tasks";

const appUrl = "https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site";

function sameSecret(received: string, expected: string) {
  let mismatch = received.length ^ expected.length;
  for (let index = 0; index < Math.max(received.length, expected.length); index++) mismatch |= (received.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  return mismatch === 0;
}

type Update = { message?: { text?: string; from?: { id?: number }; chat?: { id?: number; type?: string } } };
const keyboard = { keyboard: [[{ text: "Ближайшие сроки" }]], resize_keyboard: true, is_persistent: true };

function send(chatId: number, text: string, replyMarkup: object = keyboard) {
  return Response.json({ method: "sendMessage", chat_id: chatId, text, reply_markup: replyMarkup });
}

export async function POST(request: Request) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !sameSecret(received, expected)) return new Response(null, { status: 403 });
  const update = await request.json().catch(() => ({})) as Update;
  const message = update.message;
  if (message?.chat?.type !== "private" || !message.chat.id || !message.from?.id) return new Response(null, { status: 200 });
  const command = message.text?.trim() ?? "";
  if (/^\/(start|help)(?:@\w+)?(?:\s|$)/.test(command)) return send(message.chat.id, "Задачи — кнопка в меню чата. Ближайшие сроки — кнопка ниже.");
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
  if (command === "Задачи") return send(message.chat.id, "Открыть задачи", { inline_keyboard: [[{ text: "Открыть", web_app: { url: appUrl } }]] });
  return new Response(null, { status: 200 });
}

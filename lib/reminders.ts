import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { reminderSettings, tasks } from "../db/schema";

export type ReminderTask = typeof tasks.$inferSelect;
const APP_URL = "https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site/";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function deadlineLabel(task: ReminderTask, now: Date) {
  if (!task.dueDate) return null;
  const date = new Date(`${task.dueDate}T12:00:00+03:00`);
  const formatter = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long" });
  const year = task.dueDate.slice(0, 4) === new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", year: "numeric" }).format(now) ? "" : ` ${task.dueDate.slice(0, 4)}`;
  return `${formatter.format(date)}${year}${task.dueTime ? `, ${task.dueTime}` : ""}`;
}

// The current app displays times in the owner's Moscow timezone.
export function reminderTime(task: Pick<ReminderTask, "dueDate" | "dueTime" | "remindMinutes" | "remindAt">) {
  if (task.remindAt) {
    const sendAt = Date.parse(task.remindAt);
    return Number.isFinite(sendAt) ? { deadline: null, sendAt } : null;
  }
  if (!task.dueDate || !task.remindMinutes) return null;
  const deadline = Date.parse(`${task.dueDate}T${task.dueTime ?? "23:59"}:00+03:00`);
  if (!Number.isFinite(deadline)) return null;
  return { deadline, sendAt: deadline - task.remindMinutes * 60_000 };
}

function globalReminderTime(task: ReminderTask, leadMinutes: number) {
  if (!task.dueDate) return null;
  const deadline = Date.parse(`${task.dueDate}T${task.dueTime ?? "23:59"}:00+03:00`);
  return Number.isFinite(deadline) ? { deadline, sendAt: deadline - leadMinutes * 60_000 } : null;
}

function isUrgent(task: ReminderTask, tomorrow: string) {
  return task.priority === 0 || Boolean(task.parentId && task.priority === 1 && task.dueDate && task.dueDate <= tomorrow);
}

export async function processReminders(now = new Date(), userId?: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot token is not configured");
  const db = getDb();
  const [pending, settings] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.completed, false), isNull(tasks.reminderSentAt), or(isNotNull(tasks.dueDate), isNotNull(tasks.remindAt)), userId ? eq(tasks.userId, userId) : undefined)),
    db.select().from(reminderSettings).where(userId ? eq(reminderSettings.userId, userId) : undefined),
  ]);
  const settingsByUser = new Map(settings.map(setting => [setting.userId, setting]));
  const tomorrow = new Date(now.getTime() + 3 * 60 * 60_000 + 24 * 60 * 60_000).toISOString().slice(0, 10);
  let sent = 0;
  let failed = 0;
  for (const task of pending) {
    const setting = settingsByUser.get(task.userId);
    if (setting?.scope === "off" || (setting?.scope === "urgent" && !isUrgent(task, tomorrow))) continue;
    const time = setting ? globalReminderTime(task, setting.leadMinutes) : reminderTime(task);
    // A delayed scheduler should still deliver recent reminders instead of silently losing them.
    if (!time || now.getTime() < time.sendAt || now.getTime() - time.sendAt > 24 * 60 * 60_000 || (setting && time.deadline && now.getTime() >= time.deadline)) continue;
    const claimedAt = now.toISOString();
    const unchangedReminder = setting
      ? and(eq(tasks.dueDate, task.dueDate!), task.dueTime ? eq(tasks.dueTime, task.dueTime) : isNull(tasks.dueTime), eq(tasks.priority, task.priority), task.parentId ? eq(tasks.parentId, task.parentId) : isNull(tasks.parentId))
      : task.remindAt
      ? eq(tasks.remindAt, task.remindAt)
      : and(isNull(tasks.remindAt), eq(tasks.dueDate, task.dueDate!), task.dueTime ? eq(tasks.dueTime, task.dueTime) : isNull(tasks.dueTime), eq(tasks.remindMinutes, task.remindMinutes!));
    const [claimed] = await db.update(tasks).set({ reminderSentAt: claimedAt }).where(and(eq(tasks.id, task.id), eq(tasks.completed, false), isNull(tasks.reminderSentAt), unchangedReminder)).returning({ id: tasks.id });
    if (!claimed) continue;
    try {
      const deadline = deadlineLabel(task, now);
      const text = `${!setting && task.remindAt ? "⏰ Напоминание" : "⏳ Скоро срок"}\n\n<b>${escapeHtml(task.title)}</b>${deadline ? `\nСрок: ${deadline}` : ""}`;
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: task.userId.replace(/^tg:/, ""),
          text,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "Открыть задачи", web_app: { url: APP_URL } }]] },
        }),
      });
      const result = await response.json() as { ok?: boolean; description?: string };
      if (!response.ok || !result.ok) {
        console.error("Reminder delivery failed", { taskId: task.id, status: response.status, reason: result.description });
        throw new Error("Telegram delivery failed");
      }
      sent++;
    } catch {
      failed++;
      await db.update(tasks).set({ reminderSentAt: null }).where(and(eq(tasks.id, task.id), eq(tasks.reminderSentAt, claimedAt)));
    }
  }
  return { sent, failed };
}

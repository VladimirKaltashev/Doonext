import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../db";
import { tasks } from "../db/schema";

export type ReminderTask = typeof tasks.$inferSelect;
const APP_URL = "https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site/";

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

export async function processReminders(now = new Date()) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot token is not configured");
  const db = getDb();
  const pending = await db.select().from(tasks).where(and(eq(tasks.completed, false), isNull(tasks.reminderSentAt), or(isNotNull(tasks.remindAt), and(isNotNull(tasks.dueDate), isNotNull(tasks.remindMinutes)))));
  let sent = 0;
  let failed = 0;
  for (const task of pending) {
    const time = reminderTime(task);
    if (!time || now.getTime() < time.sendAt || (time.deadline !== null && now.getTime() >= time.deadline)) continue;
    const claimedAt = now.toISOString();
    const unchangedReminder = task.remindAt
      ? eq(tasks.remindAt, task.remindAt)
      : and(isNull(tasks.remindAt), eq(tasks.dueDate, task.dueDate!), task.dueTime ? eq(tasks.dueTime, task.dueTime) : isNull(tasks.dueTime), eq(tasks.remindMinutes, task.remindMinutes!));
    const [claimed] = await db.update(tasks).set({ reminderSentAt: claimedAt }).where(and(eq(tasks.id, task.id), eq(tasks.completed, false), isNull(tasks.reminderSentAt), unchangedReminder)).returning({ id: tasks.id });
    if (!claimed) continue;
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: task.userId.replace(/^tg:/, ""), text: task.remindAt ? `Напоминание: ${task.title}${task.dueDate ? `\nСрок: ${task.dueDate}${task.dueTime ? `, ${task.dueTime}` : ""}` : ""}\n${APP_URL}` : `Скоро срок: ${task.title}\nДо ${task.dueDate}${task.dueTime ? `, ${task.dueTime}` : ""}\n${APP_URL}` }),
      });
      const result = await response.json() as { ok?: boolean };
      if (!response.ok || !result.ok) throw new Error("Telegram delivery failed");
      sent++;
    } catch {
      failed++;
      await db.update(tasks).set({ reminderSentAt: null }).where(and(eq(tasks.id, task.id), eq(tasks.reminderSentAt, claimedAt)));
    }
  }
  return { sent, failed };
}

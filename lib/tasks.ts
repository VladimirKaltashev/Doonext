import { and, eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { reminderSettings, tasks } from "../db/schema";

export type TaskInput = { title?: unknown; dueDate?: unknown; dueTime?: unknown; estimateMinutes?: unknown; remindMinutes?: unknown; remindAt?: unknown; priority?: unknown; parentId?: unknown };

function parseDueTime(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Неверное время");
  return value;
}

function parseReminder(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const minutes = Number(value);
  if (![5, 15, 30, 60, 180, 1440].includes(minutes)) throw new Error("Неверное время напоминания");
  return minutes;
}

function parseRemindAt(value: unknown, allowPast = false) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new Error("Неверное время напоминания");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || (!allowPast && timestamp <= Date.now())) throw new Error("Выберите будущее время напоминания");
  return new Date(timestamp).toISOString();
}

function parseEstimate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) throw new Error("Оценка должна быть от 1 до 10080 минут");
  return minutes;
}

export async function listTasks(userId: string) {
  return getDb().select().from(tasks).where(eq(tasks.userId, userId));
}

export async function createTask(userId: string, input: TaskInput) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 240) throw new Error("Укажите название задачи до 240 символов");
  const dueDate = input.dueDate === null || input.dueDate === "" || input.dueDate === undefined ? null : String(input.dueDate);
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Неверная дата");
  const dueTime = parseDueTime(input.dueTime);
  if (dueTime && !dueDate) throw new Error("Для времени выберите дату");
  const estimateMinutes = parseEstimate(input.estimateMinutes);
  const remindMinutes = parseReminder(input.remindMinutes);
  const remindAt = parseRemindAt(input.remindAt);
  if (remindMinutes && !dueDate) throw new Error("Для напоминания выберите срок");
  if (remindMinutes && remindAt) throw new Error("Выберите одно напоминание");
  const priority = Number(input.priority ?? 2);
  if (![0, 1, 2, 3].includes(priority)) throw new Error("Неверная важность");
  const parentId = input.parentId ? String(input.parentId) : null;
  if (parentId) {
    const [parent] = await getDb().select().from(tasks).where(and(eq(tasks.id, parentId), eq(tasks.userId, userId)));
    if (!parent || parent.parentId) throw new Error("Главная задача не найдена");
  }
  const [task] = await getDb().insert(tasks).values({ id: crypto.randomUUID(), userId, title, dueDate, dueTime, estimateMinutes, remindMinutes, remindAt, priority, parentId, createdAt: new Date().toISOString() }).returning();
  return task;
}

export async function updateTask(userId: string, id: string, input: Record<string, unknown>) {
  const [old] = await getDb().select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  if (!old) throw new Error("Задача не найдена");
  const changes: Partial<typeof tasks.$inferInsert> = {};
  if (typeof input.completed === "boolean") {
    changes.completed = input.completed;
    if (input.completed && !old.completed) changes.completedAt = new Date().toISOString();
    if (!input.completed) changes.completedAt = null;
  }
  if (typeof input.inProgress === "boolean") changes.inProgress = input.inProgress;
  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title || title.length > 240) throw new Error("Неверное название");
    changes.title = title;
  }
  if (input.dueDate === null || input.dueDate === "" || typeof input.dueDate === "string") {
    const date = input.dueDate ? String(input.dueDate) : null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Неверная дата");
    changes.dueDate = date;
    if (!date) { changes.dueTime = null; changes.remindMinutes = null; }
    if (date !== old.dueDate && !old.remindAt) changes.reminderSentAt = null;
  }
  if (input.dueTime !== undefined) {
    const dueTime = parseDueTime(input.dueTime);
    if (dueTime && !(changes.dueDate !== undefined ? changes.dueDate : old.dueDate)) throw new Error("Для времени выберите дату");
    changes.dueTime = dueTime;
    if (dueTime !== old.dueTime && !old.remindAt) changes.reminderSentAt = null;
  }
  if (input.estimateMinutes !== undefined) changes.estimateMinutes = parseEstimate(input.estimateMinutes);
  if (input.remindMinutes !== undefined) {
    const remindMinutes = parseReminder(input.remindMinutes);
    if (remindMinutes && !(changes.dueDate !== undefined ? changes.dueDate : old.dueDate)) throw new Error("Для напоминания выберите срок");
    changes.remindMinutes = remindMinutes;
    if (remindMinutes !== old.remindMinutes) changes.reminderSentAt = null;
  }
  if (input.remindAt !== undefined) {
    const remindAt = parseRemindAt(input.remindAt, input.remindAt === old.remindAt);
    changes.remindAt = remindAt;
    if (remindAt !== old.remindAt) changes.reminderSentAt = null;
  }
  if ((changes.remindAt !== undefined ? changes.remindAt : old.remindAt) && (changes.remindMinutes !== undefined ? changes.remindMinutes : old.remindMinutes)) throw new Error("Выберите одно напоминание");
  if (input.priority !== undefined) {
    const priority = Number(input.priority);
    if (![0, 1, 2, 3].includes(priority)) throw new Error("Неверная важность");
    changes.priority = priority;
  }
  if (old.remindAt && ((changes.dueDate !== undefined && changes.dueDate !== old.dueDate) || (changes.dueTime !== undefined && changes.dueTime !== old.dueTime))) {
    const [globalSetting] = await getDb().select({ userId: reminderSettings.userId }).from(reminderSettings).where(eq(reminderSettings.userId, userId));
    if (globalSetting) changes.reminderSentAt = null;
  }
  if (!Object.keys(changes).length) return old;
  const [task] = await getDb().update(tasks).set(changes).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).returning();
  return task;
}

export async function deleteTask(userId: string, id: string) {
  const db = getDb();
  const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  if (!task) throw new Error("Задача не найдена");
  await db.delete(tasks).where(and(eq(tasks.userId, userId), or(eq(tasks.id, id), eq(tasks.parentId, id))));
}

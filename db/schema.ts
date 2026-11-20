import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  dueDate: text("due_date"),
  dueTime: text("due_time"),
  estimateMinutes: integer("estimate_minutes"),
  remindMinutes: integer("remind_minutes"),
  reminderSentAt: text("reminder_sent_at"),
  priority: integer("priority").notNull().default(2),
  parentId: text("parent_id"),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  inProgress: integer("in_progress", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const migrationClaims = sqliteTable("migration_claims", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  claimedAt: text("claimed_at").notNull(),
});

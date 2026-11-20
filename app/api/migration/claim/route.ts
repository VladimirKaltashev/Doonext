import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { migrationClaims, tasks } from "../../../../db/schema";
import { telegramError, telegramUserId } from "../../../../lib/telegram-auth";

type OldTask = typeof tasks.$inferInsert;
type PackedTask = [string, string, string | null, string | null, number | null, number, string | null, boolean, string | null, boolean, string];

function sameCode(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return mismatch === 0;
}

export async function POST(request: Request) {
  let userId: string;
  try { userId = await telegramUserId(request); } catch (error) { return telegramError(error); }
  if (!env.MIGRATION_PAYLOAD || !env.MIGRATION_KEY) return Response.json({ error: "Перенос недоступен" }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { code?: unknown };
  if (typeof body.code !== "string" || !sameCode(body.code.trim(), env.MIGRATION_KEY)) return Response.json({ error: "Неверный код" }, { status: 403 });
  const db = getDb();
  const [claimed] = await db.select().from(migrationClaims).where(eq(migrationClaims.id, "initial"));
  if (claimed) return Response.json({ error: "Задачи уже перенесены" }, { status: 409 });
  let source: OldTask[];
  try {
    const packed = JSON.parse(env.MIGRATION_PAYLOAD) as PackedTask[];
    if (!Array.isArray(packed) || packed.length > 2000 || packed.some(row => !Array.isArray(row) || row.length !== 11)) throw new Error("Invalid payload");
    source = packed.map(([id, title, dueDate, dueTime, estimateMinutes, priority, parentId, completed, completedAt, inProgress, createdAt]) => ({
      id, title, dueDate, dueTime, estimateMinutes, priority, parentId, completed, completedAt, inProgress, createdAt, userId,
    }));
  }
  catch { return Response.json({ error: "Данные переноса недоступны" }, { status: 500 }); }
  try {
    // D1 accepts at most 100 bound parameters per query; each task uses 12.
    for (let index = 0; index < source.length; index += 8) {
      await db.insert(tasks).values(source.slice(index, index + 8).map(task => ({
        id: String(task.id),
        userId,
        title: String(task.title),
        dueDate: task.dueDate ?? null,
        dueTime: task.dueTime ?? null,
        estimateMinutes: task.estimateMinutes ?? null,
        priority: task.priority ?? 2,
        parentId: task.parentId ?? null,
        completed: Boolean(task.completed),
        completedAt: task.completedAt ?? null,
        inProgress: Boolean(task.inProgress),
        createdAt: String(task.createdAt),
      }))).onConflictDoNothing();
    }
    await db.insert(migrationClaims).values({ id: "initial", userId, claimedAt: new Date().toISOString() });
    return Response.json({ imported: source.length });
  } catch {
    return Response.json({ error: "Не удалось перенести задачи" }, { status: 500 });
  }
}

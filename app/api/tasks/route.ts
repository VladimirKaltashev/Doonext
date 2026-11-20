import { createTask, listTasks } from "../../../lib/tasks";
import { telegramError, telegramUserId } from "../../../lib/telegram-auth";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { migrationClaims } from "../../../db/schema";

export async function GET(request: Request) {
  let userId: string;
  try { userId = await telegramUserId(request); } catch (error) { return telegramError(error); }
  try {
    const [rows, claimed] = await Promise.all([
      listTasks(userId),
      getDb().select().from(migrationClaims).where(eq(migrationClaims.id, "initial")),
    ]);
    return Response.json({ tasks: rows, canImport: Boolean(env.MIGRATION_PAYLOAD && env.MIGRATION_KEY && !claimed.length) });
  }
  catch { return Response.json({ error: "Не удалось загрузить задачи" }, { status: 500 }); }
}
export async function POST(request: Request) {
  let userId: string;
  try { userId = await telegramUserId(request); } catch (error) { return telegramError(error); }
  try { return Response.json({ task: await createTask(userId, await request.json()) }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 400 }); }
}

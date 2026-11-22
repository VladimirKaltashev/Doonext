import { processReminders } from "../../../../lib/reminders";
import { telegramError, telegramUserId } from "../../../../lib/telegram-auth";

export async function POST(request: Request) {
  let userId: string;
  try { userId = await telegramUserId(request); }
  catch (error) { return telegramError(error); }
  try { return Response.json(await processReminders(new Date(), userId)); }
  catch { return Response.json({ error: "Не удалось проверить напоминания" }, { status: 500 }); }
}

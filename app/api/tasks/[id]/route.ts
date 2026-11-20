import { deleteTask, updateTask } from "../../../../lib/tasks";
import { telegramError, telegramUserId } from "../../../../lib/telegram-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  try { userId = await telegramUserId(request); } catch (error) { return telegramError(error); }
  try { const { id } = await context.params; return Response.json({ task: await updateTask(userId, id, await request.json()) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 400 }); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  try { userId = await telegramUserId(request); } catch (error) { return telegramError(error); }
  try { const { id } = await context.params; await deleteTask(userId, id); return Response.json({ deleted: true }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ошибка удаления" }, { status: 400 }); }
}

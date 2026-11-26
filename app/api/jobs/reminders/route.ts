import { env } from "cloudflare:workers";
import { processReminders } from "../../../../lib/reminders";
import { ensureCallbackUpdates } from "../../../../lib/telegram-webhook";

function sameSecret(received: string, expected: string) {
  let difference = received.length ^ expected.length;
  for (let i = 0; i < Math.max(received.length, expected.length); i++) difference |= (received.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  return difference === 0;
}

export async function POST(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const authorized = [env.REMINDER_JOB_SECRET, env.SCHEDULER_JOB_SECRET]
    .some((secret) => !!secret && sameSecret(supplied, secret));
  if (!authorized) return new Response(null, { status: 403 });
  try { await ensureCallbackUpdates(); }
  catch (error) { console.error("Telegram webhook check failed", error); }
  try { return Response.json(await processReminders()); }
  catch { return Response.json({ error: "Не удалось обработать напоминания" }, { status: 500 }); }
}

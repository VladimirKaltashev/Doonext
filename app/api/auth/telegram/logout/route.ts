import { clearSessionCookie } from "../../../../../lib/telegram-session";

export function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}

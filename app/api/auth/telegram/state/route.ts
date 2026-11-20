import { loginStateCookie, newLoginState } from "../../../../../lib/telegram-session";

export function GET() {
  const state = newLoginState();
  return Response.json({ state }, { headers: { "Set-Cookie": loginStateCookie(state), "Cache-Control": "no-store" } });
}

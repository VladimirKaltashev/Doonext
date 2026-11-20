import { env } from "cloudflare:workers";
import { clearLoginStateCookie, createSession, loginStateFromCookie, sessionCookie, verifyTelegramLogin } from "../../../../lib/telegram-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const savedState = loginStateFromCookie(request);
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token || !state || !savedState || state !== savedState) return Response.redirect(new URL("/?login=error", url), 303);
  try {
    const id = await verifyTelegramLogin(url.searchParams, token);
    const headers = new Headers({ Location: new URL("/", url).toString(), "Cache-Control": "no-store" });
    headers.append("Set-Cookie", sessionCookie(await createSession(id, token)));
    headers.append("Set-Cookie", clearLoginStateCookie());
    return new Response(null, { status: 303, headers });
  } catch {
    return Response.redirect(new URL("/?login=error", url), 303);
  }
}

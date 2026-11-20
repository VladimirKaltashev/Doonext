const encoder = new TextEncoder();
const SESSION_COOKIE = "doonext_session";
const STATE_COOKIE = "doonext_login_state";
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function toHex(bytes: Uint8Array) { return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }
function bytesFromHex(hex: string) { return Uint8Array.from(hex.match(/.{2}/g) ?? [], part => parseInt(part, 16)); }
async function key(token: string, purpose: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(purpose + token));
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(value: string, token: string, purpose: string) {
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", await key(token, purpose), encoder.encode(value))));
}
async function valid(value: string, signature: string, token: string, purpose: string) {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  return crypto.subtle.verify("HMAC", await key(token, purpose), bytesFromHex(signature), encoder.encode(value));
}
function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(name + "="))?.slice(name.length + 1) ?? null;
}
export function loginStateFromCookie(request: Request) { return cookieValue(request, STATE_COOKIE); }
export function newLoginState() { return toHex(crypto.getRandomValues(new Uint8Array(24))); }
export function loginStateCookie(value: string) { return `${STATE_COOKIE}=${value}; Path=/api/auth/telegram; HttpOnly; Secure; SameSite=Lax; Max-Age=600`; }
export function clearLoginStateCookie() { return `${STATE_COOKIE}=; Path=/api/auth/telegram; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
export function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }

export async function verifyTelegramLogin(params: URLSearchParams, token: string, now = Math.floor(Date.now() / 1000)) {
  const entries = [...params.entries()].filter(([name]) => name !== "state");
  if (new Set(entries.map(([name]) => name)).size !== entries.length) throw new Error("Неверные данные входа");
  const signature = params.get("hash") ?? "";
  const id = params.get("id") ?? "";
  const authDate = Number(params.get("auth_date"));
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || !Number.isSafeInteger(authDate) || authDate > now + 60 || now - authDate > 600) throw new Error("Вход устарел");
  const check = entries.filter(([name]) => name !== "hash").sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${name}=${value}`).join("\n");
  if (!await valid(check, signature, token, "")) throw new Error("Неверная подпись Telegram");
  return id;
}

export async function createSession(id: string, token: string) {
  const payload = `${id}.${Math.floor(Date.now() / 1000) + SESSION_SECONDS}`;
  return `${payload}.${await sign(payload, token, "doonext-session:")}`;
}
export function sessionCookie(value: string) { return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`; }
export async function sessionUserId(request: Request, token: string) {
  const value = cookieValue(request, SESSION_COOKIE);
  if (!value) return null;
  const match = /^(\d+)\.(\d+)\.([a-f0-9]{64})$/.exec(value);
  if (!match || Number(match[2]) < Date.now() / 1000 || !await valid(`${match[1]}.${match[2]}`, match[3], token, "doonext-session:")) return null;
  return `tg:${match[1]}`;
}

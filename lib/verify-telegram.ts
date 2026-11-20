const text = new TextEncoder();

function bytesFromHex(value: string) {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], pair => Number.parseInt(pair, 16));
}

function bytesFromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function verifyTelegramInitData(raw: string | null, botId: string, publicKeyHex: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  if (!raw || raw.length > 8192) throw new Error("Откройте приложение в Telegram");
  const params = new URLSearchParams(raw);
  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error("Неверные данные Telegram");
  const signature = params.get("signature");
  const authDate = Number(params.get("auth_date"));
  if (!signature || !Number.isSafeInteger(authDate) || authDate > now + 300 || now - authDate > 86400) throw new Error("Откройте приложение в Telegram заново");
  const checkString = `${botId}:WebAppData\n` + entries
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const key = await crypto.subtle.importKey("raw", bytesFromHex(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("Ed25519", key, bytesFromBase64Url(signature), text.encode(checkString));
  if (!valid) throw new Error("Неверные данные Telegram");
  let user: unknown;
  try { user = JSON.parse(params.get("user") ?? "null"); } catch { throw new Error("Неверные данные Telegram"); }
  const id = user && typeof user === "object" && "id" in user ? (user as { id: unknown }).id : null;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw new Error("Не найден пользователь Telegram");
  return `tg:${id}`;
}

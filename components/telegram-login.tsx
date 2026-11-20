"use client";

import { useEffect, useRef, useState } from "react";

export function TelegramLogin() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(() => typeof window !== "undefined" && new URLSearchParams(location.search).get("login") === "error" ? "Не удалось войти через Telegram" : "");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/telegram/state", { cache: "no-store" }).then(response => response.json()).then((data: unknown) => {
      const { state } = data as { state: string };
      if (cancelled || !host.current) return;
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.setAttribute("data-telegram-login", "tasks_planner29_bot");
      script.setAttribute("data-size", "large");
      script.setAttribute("data-radius", "8");
      script.setAttribute("data-request-access", "write");
      script.setAttribute("data-auth-url", `${location.origin}/api/auth/telegram?state=${state}`);
      host.current.replaceChildren(script);
    }).catch(() => { if (!cancelled) setError("Не удалось открыть вход"); });
    return () => { cancelled = true; };
  }, []);
  return <div className="login-box"><h1>Doonext</h1><div ref={host}/>{error && <div className="error">{error}</div>}</div>;
}

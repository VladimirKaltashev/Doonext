import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doonext",
  description: "Задачи, сроки и история выполненного в Telegram",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><script src="https://telegram.org/js/telegram-web-app.js"></script></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}

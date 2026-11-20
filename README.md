# Doonext

Doonext is a Telegram Mini App for keeping tasks in deadline order, choosing priorities, and reviewing completed work. A Telegram bot also shows upcoming deadlines without opening the app.

## What it does

- Tasks and subtasks with dates, optional time, priority, and estimated duration
- Today, upcoming, and completed views with a completion heatmap
- Read-only deadline summary in the bot
- One-time migration from the earlier task site

The interface is in Russian. The current production Mini App is hosted at [telegram-zadachi-vlad-2026.vladongold.chatgpt.site](https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site/).

## Stack

Next.js, React, Vinext, Cloudflare Workers, D1, Drizzle ORM, and the Telegram Web App API. The hosted Site configuration is in `.openai/hosting.json`; database tables are defined in `db/schema.ts` and the migration in `drizzle/`.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

For a production build, run `npm run build`. D1 and Telegram features require bindings and environment variables configured for the hosting environment. Do not commit `.env` files, bot tokens, webhook secrets, migration codes, or task exports.

## Telegram setup

The bot webhook is implemented at `/api/telegram/webhook`. Set `TELEGRAM_BOT_ID` and `TELEGRAM_WEBHOOK_SECRET` in the hosting environment, then register the deployed HTTPS webhook with Telegram. The bot token is only needed when configuring Telegram; the application does not store it. The Mini App verifies Telegram `initData` on the server before accessing tasks. Tasks are stored in Cloudflare D1, scoped to the Telegram user ID.

The current bot URL and webhook Mini App URL are set in `app/api/telegram/webhook/route.ts`. Update them if you move the deployment to a new domain.

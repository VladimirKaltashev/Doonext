# Doonext

Doonext is a Telegram Mini App for keeping tasks in deadline order, choosing priorities, and reviewing completed work. A Telegram bot also shows upcoming deadlines without opening the app.

## What it does

- Tasks and subtasks with dates, optional time, priority, estimated duration, and Telegram reminders
- Today, upcoming, and completed views with a completion heatmap
- Read-only deadline summary in the bot
- One-time migration from the earlier task site

The same task list works inside Telegram and in a regular browser after Telegram sign-in. The interface is in Russian. The current production Mini App is hosted at [telegram-zadachi-vlad-2026.vladongold.chatgpt.site](https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site/).

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

The bot webhook is implemented at `/api/telegram/webhook`. Set `TELEGRAM_BOT_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `REMINDER_JOB_SECRET` in the hosting environment, then register the deployed HTTPS webhook with Telegram. Store the token and secrets as hosting secrets, never in Git. The Mini App verifies Telegram `initData` on the server before accessing tasks. Tasks are stored in Cloudflare D1, scoped to the Telegram user ID.

The current bot URL and webhook Mini App URL are set in `app/api/telegram/webhook/route.ts`. Update them if you move the deployment to a new domain.

## Website sign-in and reminders

In @BotFather, select the bot and use `/setdomain` with `telegram-zadachi-vlad-2026.vladongold.chatgpt.site` for the Telegram Login Widget. A browser session uses a signed, HttpOnly cookie; the Mini App continues to use signed Telegram `initData`. Both resolve to the same Telegram user ID and D1 records.

The reminder selector appears after choosing a due date. A date without a time is treated as 23:59 in Europe/Moscow. The bot must have an open chat with the user before it can send messages. GitHub Actions calls `/api/jobs/reminders` every five minutes; set the repository secret `DOONEXT_REMINDER_JOB_SECRET` to the same value as the hosting secret `REMINDER_JOB_SECRET`. The endpoint rejects requests without that secret. Scheduled GitHub jobs can be delayed, so reminders are approximate.

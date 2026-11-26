# Doonext

Doonext is a Telegram Mini App for keeping tasks in deadline order, choosing priorities, and reviewing completed work. A Telegram bot also shows upcoming deadlines without opening the app.

## What it does

- Tasks and subtasks with dates, optional time, and priority
- Today, upcoming, and completed views with a completion heatmap
- Read-only deadline summary and reminder settings in the bot
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

The bot's `/start` keyboard has “Открыть задачи” and “Настроить” side by side. `/settings` opens the same reminder settings: all tasks, urgent tasks, or off; 5, 15, or 30 minutes, 1 or 3 hours, or 1 day before the deadline. Settings are stored per Telegram user in D1. Once a setting is chosen, it applies to existing and new tasks with deadlines. Previously configured task reminders continue until a global setting is chosen. Reminder times are interpreted in Europe/Moscow. A deadline without a time is treated as 23:59. The bot must have an open chat with the user before it can send messages. The app checks due reminders while open. GitHub Actions is configured to call `/api/jobs/reminders` every five minutes as a fallback, but observed scheduled runs have been hours apart. The endpoint accepts `REMINDER_JOB_SECRET` for GitHub Actions or `SCHEDULER_JOB_SECRET` for the separate Cloudflare Cron Worker. The repository secret `DOONEXT_REMINDER_JOB_SECRET` must match the former. The Worker in `scheduler/` is deployed as `doonext-reminder-scheduler` on Cloudflare Workers Free, with a Cron Trigger every minute. `SCHEDULER_JOB_SECRET` is stored as a secret in both the Site and the Worker. The first scheduled invocation succeeded on November 22, 2026.

interface Env {
  SCHEDULER_JOB_SECRET: string;
}

const REMINDER_URL = "https://telegram-zadachi-vlad-2026.vladongold.chatgpt.site/api/jobs/reminders";

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const response = await fetch(REMINDER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.SCHEDULER_JOB_SECRET}` },
      });
      if (!response.ok) throw new Error(`Reminder check failed: ${response.status}`);
      const result = await response.json() as { sent: number; failed: number };
      if (result.failed) throw new Error(`Telegram delivery failed for ${result.failed} reminder(s)`);
      console.log(`Reminder check: ${result.sent} sent, ${result.failed} failed`);
    })());
  },
};

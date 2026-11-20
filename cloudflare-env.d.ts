declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TELEGRAM_BOT_ID?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    MIGRATION_KEY?: string;
    MIGRATION_PAYLOAD?: string;
  }
}

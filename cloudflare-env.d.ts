declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    BREVO_API_KEY?: string;
    EMAIL_REMETENTE?: string;
  }
}

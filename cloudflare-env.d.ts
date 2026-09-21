declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: KVNamespace;
    BREVO_API_KEY?: string;
    EMAIL_REMETENTE?: string;
  }
}

/// <reference types="astro/client" />

type CloudflareRuntime = import("@astrojs/cloudflare").Runtime;

declare namespace App {
  interface Locals extends CloudflareRuntime {
    /** Set by middleware for /admin and /api/admin after Access verification. */
    adminEmail?: string;
  }
}

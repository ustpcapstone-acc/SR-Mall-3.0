// @ts-nocheck — `.open-next/worker.js` only exists after `npm run cf:build`.
/**
 * Cloudflare Workers entry: serves the Next.js app (OpenNext) and runs the
 * daily jobs that `vercel.json` schedules on Vercel. Schedules (UTC) are in
 * wrangler.jsonc → triggers.crons and must match the keys below.
 */
import { default as handler } from "./.open-next/worker.js";

const CRON_ROUTES: Record<string, string> = {
  "0 0 * * *": "/api/cron/billing-reminders",
  "0 1 * * *": "/api/cron/lease-expiries",
  "0 2 * * *": "/api/cron/process-reservations",
};

export default {
  fetch: handler.fetch,

  async scheduled(event, env, ctx) {
    const path = CRON_ROUTES[event.cron];
    if (!path) return;
    ctx.waitUntil(
      handler
        .fetch(new Request(`https://${env.WORKER_HOSTNAME || "sr-mall.workers.dev"}${path}`), env, ctx)
        .then((res) => console.log(`[cron] ${path} → ${res.status}`))
        .catch((err) => console.error(`[cron] ${path} failed:`, err)),
    );
  },
};

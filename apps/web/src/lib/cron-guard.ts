import { NextResponse } from "next/server";

/**
 * Scheduled jobs run once, on the main Vercel project.
 *
 * Two Vercel projects deploy this app (sr-mall-3-0-web serves
 * sophieredmall.com; "web" is a second copy) and both register the crons in
 * vercel.json, so without this every reminder would go out twice. When
 * Vercel's scheduler calls a job on a project whose production domain isn't
 * the main one, the job is skipped.
 *
 * Fail-safe: if Vercel doesn't report the project's domain (or this isn't
 * Vercel at all, e.g. local dev), the job runs, so the main site never stops
 * sending reminders. Manual calls (no "vercel-cron" user agent) always run.
 * Set CRON_PRIMARY_HOST to move the jobs to another domain.
 */
export function skipDuplicateCron(req: Request): NextResponse | null {
  const fromScheduler = (req.headers.get("user-agent") || "").toLowerCase().includes("vercel-cron");
  const projectHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").toLowerCase();
  const primary = (process.env.CRON_PRIMARY_HOST || "sophieredmall.com").toLowerCase();
  if (!fromScheduler || !projectHost || projectHost.includes(primary)) return null;
  return NextResponse.json({
    success: true,
    skipped: `This project (${projectHost}) is not the main one (${primary}); the job runs there instead.`,
  });
}

import Link from "next/link";
import { ArrowLeft, Home, MapPin, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-16 dark:bg-black">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-lg shadow-primary/10">
          <MapPin size={28} />
        </div>

        <p className="text-xs font-semibold text-primary">
          SR-MANAGE
        </p>
        <h1 className="mt-3 bg-linear-to-br from-charcoal via-charcoal to-slate-400 bg-clip-text text-7xl font-semibold tracking-tight text-transparent dark:from-white dark:via-white dark:to-zinc-600 sm:text-8xl">
          404
        </h1>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-charcoal dark:text-white sm:text-3xl">
          This floor is empty.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          The page you are looking for may have moved, been removed, or never existed. Let&apos;s get you back to the mall directory.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-xs font-semibold text-white shadow-xl shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95 sm:w-auto"
          >
            <Home size={16} /> Back to home
          </Link>
          <Link
            href="/tenant-directory"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-xs font-semibold text-slate-600 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary dark:border-white/10 dark:bg-zinc-900 dark:text-slate-300 sm:w-auto"
          >
            <Search size={16} /> Browse shops
          </Link>
        </div>

        <Link
          href="/available-spaces"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-primary"
        >
          <ArrowLeft size={12} /> Looking for available spaces?
        </Link>
      </div>
    </main>
  );
}

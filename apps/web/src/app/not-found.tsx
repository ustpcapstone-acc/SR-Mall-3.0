import Link from "next/link";

const BUTTON = "inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-semibold sm:w-auto";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-kumo-recessed px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-kumo-line bg-kumo-base p-8 text-center sm:p-10">
        <p className="font-display text-6xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-kumo-default sm:text-3xl">
          This floor is empty.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-kumo-subtle">
          The page you are looking for may have moved, been removed, or never existed.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/" className={`${BUTTON} bg-primary text-white hover:bg-primary-hover`}>
            Back to home
          </Link>
          <Link href="/tenant-directory" className={`${BUTTON} border border-kumo-line text-kumo-default hover:bg-kumo-tint`}>
            Browse shops
          </Link>
        </div>

        <Link href="/available-spaces" className="mt-5 inline-block text-sm font-medium text-kumo-link hover:underline">
          Looking for available spaces?
        </Link>
      </div>
    </main>
  );
}

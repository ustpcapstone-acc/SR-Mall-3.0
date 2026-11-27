"use client";

const isVideoUrl = (url: string) => url.startsWith("data:video") || /\.(mp4|webm|ogg)$/i.test(url);

/** A card's picture or video, or a note that there is none. */
export function Thumb({ url, alt, empty = "No image" }: { url?: string | null; alt: string; empty?: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-kumo-recessed">
      {!url ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-kumo-subtle">{empty}</p>
      ) : isVideoUrl(url) ? (
        <video src={url} className="absolute inset-0 size-full object-cover" autoPlay muted loop playsInline aria-label={alt} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  );
}

/** A small button that opens the file picker. */
export function FileButton({
  accept,
  onChange,
  disabled,
  children,
}: {
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex h-6.5 cursor-pointer items-center rounded-md border border-kumo-line px-2 text-xs font-medium text-kumo-default hover:bg-kumo-tint focus-within:ring-2 focus-within:ring-kumo-brand has-disabled:pointer-events-none has-disabled:opacity-60">
      {children}
      <input type="file" accept={accept} disabled={disabled} className="sr-only" onChange={onChange} />
    </label>
  );
}

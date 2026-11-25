"use client";

import { useEffect, useState } from "react";
import { Button, Dialog } from "@cloudflare/kumo";

/*
 * "Are you sure?" in the site's own style, with a title that says what will
 * happen and a button that names the action, instead of the browser's
 * OK / Cancel box.
 *
 *   if (!(await confirmAction({ title: "Delete this banner?", confirmLabel: "Delete banner" }))) return;
 *
 * <ConfirmHost /> is mounted once in the root layout.
 */
export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red button for actions that delete or can't be undone (default). */
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((p: Pending) => void) | null = null;

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // Without a mounted host, fall back to the browser's box rather than acting unasked.
  if (!show) return Promise.resolve(window.confirm([options.title, options.description].filter(Boolean).join("\n\n")));
  return new Promise((resolve) => show!({ ...options, resolve }));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    show = (p) => {
      setPending((previous) => {
        previous?.resolve(false);
        return p;
      });
      setOpen(true);
    };
    return () => {
      show = null;
    };
  }, []);

  const answer = (ok: boolean) => {
    // The text stays in place while the dialog fades out.
    setOpen(false);
    pending?.resolve(ok);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && answer(false)}>
      <Dialog className="w-[calc(100vw-1.5rem)] max-w-md p-5 sm:p-6">
        {pending && (
          <>
            <Dialog.Title className="text-lg font-semibold text-kumo-default">{pending.title}</Dialog.Title>
            {pending.description && (
              <Dialog.Description className="mt-2 text-sm text-kumo-subtle">{pending.description}</Dialog.Description>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => answer(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button variant={pending.destructive === false ? "primary" : "destructive"} onClick={() => answer(true)}>
                {pending.confirmLabel}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Dialog.Root>
  );
}

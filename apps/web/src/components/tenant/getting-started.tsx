"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo";
import { Check } from "@phosphor-icons/react";

export type SetupProgress = {
  hasSpace: boolean;
  hasPendingRequest: boolean;
  storefront: { logo: boolean; description: boolean; product: boolean };
};

/**
 * "What do I do next?" for a new tenant. The first unfinished step is the
 * current one and carries the button; the list disappears once all are done.
 */
export function GettingStarted({
  progress,
  onOpenStorefront,
  opening,
}: {
  progress: SetupProgress;
  onOpenStorefront: () => void;
  opening: boolean;
}) {
  const router = useRouter();
  const { hasSpace, hasPendingRequest, storefront } = progress;
  const missing = [
    !storefront.logo && "a logo",
    !storefront.description && "a description",
    !storefront.product && "at least one product",
  ].filter(Boolean) as string[];

  const steps = [
    { title: "Create your account", done: true, help: "Done." },
    {
      title: "Choose a space and send a request",
      done: hasSpace || hasPendingRequest,
      help: "Pick an available space on Rent a Space and choose how many months.",
      action: (
        <Button variant="primary" onClick={() => router.push("/tenantdashboard/rent-a-space")}>
          Choose a space
        </Button>
      ),
    },
    {
      title: "Pay at the management office and get approved",
      done: hasSpace,
      help: "Pay for your request at the SR Mall management office. The space is yours once the office approves it.",
      action: (
        <Link href="/tenantdashboard/rent-a-space" className="text-sm font-medium text-kumo-link hover:underline">
          View my request
        </Link>
      ),
    },
    {
      title: "Set up your storefront",
      done: hasSpace && missing.length === 0,
      help: missing.length
        ? `Shoppers see this page. Still needed: ${missing.join(", ")}.`
        : "Shoppers see this page.",
      action: (
        <Button variant="primary" loading={opening} onClick={onOpenStorefront}>
          Open my storefront
        </Button>
      ),
    },
  ];

  const current = steps.findIndex((s) => !s.done);
  if (current === -1) return null;
  const done = steps.filter((s) => s.done).length;

  return (
    <section className="rounded-xl border border-kumo-line bg-kumo-base p-5" aria-labelledby="getting-started-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="getting-started-heading" className="text-lg font-semibold text-kumo-default">
          Getting started
        </h2>
        <p className="text-sm text-kumo-subtle">
          {done} of {steps.length} steps done
        </p>
      </div>
      <ol className="mt-4 space-y-4">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <li key={step.title} className="flex gap-3" aria-current={isCurrent ? "step" : undefined}>
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? "bg-kumo-success-tint text-kumo-success"
                    : isCurrent
                      ? "bg-primary text-white"
                      : "border border-kumo-line text-kumo-subtle"
                }`}
              >
                {step.done ? <Check size={14} weight="bold" aria-label="Done" /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${isCurrent || step.done ? "text-kumo-default" : "text-kumo-subtle"}`}>
                  {step.title}
                </p>
                {isCurrent && (
                  <>
                    <p className="mt-0.5 text-sm text-kumo-subtle">{step.help}</p>
                    {step.action && <div className="mt-2">{step.action}</div>}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banner, Button, Checkbox, Input, Loader, Select } from "@cloudflare/kumo";
import { Check, FileText, UploadSimple, X } from "@phosphor-icons/react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/app/providers";
import { checkTenantEmailAction, registerTenantAction } from "@/app/actions/tenant-onboarding";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";
import {
  DOC_MAX_BYTES,
  DOC_TYPES,
  PASSWORD_MIN,
  TENANT_DOCUMENTS,
  TENANT_DOC_FOLDER,
  checkAccount,
  checkBusiness,
  checkDocuments,
  type StepErrors,
  type TenantApplication,
  type TenantDocType,
  type TenantDocument,
} from "@/lib/tenant-onboarding";

const STEPS = [
  { title: "Account", description: "Your sign-in details" },
  { title: "Business", description: "Company and store" },
  { title: "Documents", description: "Business papers" },
  { title: "Review", description: "Check and submit" },
];

const EMPTY: TenantApplication = {
  name: "",
  email: "",
  password: "",
  companyName: "",
  shopName: "",
  category: "",
  phone: "",
  businessAddress: "",
  documents: [],
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Registration steps">
      {STEPS.map((s, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={s.title} aria-current={state === "current" ? "step" : undefined} className="min-w-0">
            <div
              className={`h-1 rounded-full ${state === "todo" ? "bg-kumo-line" : "bg-kumo-brand"}`}
              aria-hidden
            />
            <p
              className={`mt-2 flex items-center gap-1 text-sm font-medium ${
                state === "todo" ? "text-kumo-subtle" : "text-kumo-default"
              }`}
            >
              {state === "done" && <Check size={14} className="shrink-0 text-kumo-brand" aria-hidden />}
              <span className="truncate">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </span>
            </p>
            <p className="hidden truncate text-xs text-kumo-subtle sm:block">{s.description}</p>
          </li>
        );
      })}
    </ol>
  );
}

function DocumentField({
  label,
  help,
  required,
  doc,
  error,
  onChange,
}: {
  label: string;
  help: string;
  required: boolean;
  doc?: TenantDocument;
  error?: string;
  onChange: (file: File | null) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | null) => {
    setBusy(true);
    try {
      await onChange(file);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${error ? "border-kumo-danger" : "border-kumo-line"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-kumo-default">
            {label} {!required && <span className="font-normal text-kumo-subtle">(optional)</span>}
          </p>
          <p className="text-sm text-kumo-subtle">{help}</p>
        </div>
        <input
          ref={input}
          type="file"
          accept={DOC_TYPES.join(",")}
          className="sr-only"
          aria-label={`Upload ${label}`}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        {!doc && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<UploadSimple />}
            loading={busy}
            onClick={() => input.current?.click()}
            className="shrink-0"
          >
            Upload
          </Button>
        )}
      </div>
      {doc && (
        <div className="mt-3 flex items-center gap-3 rounded-md bg-kumo-recessed p-3">
          <FileText size={20} className="shrink-0 text-kumo-subtle" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-kumo-default">{doc.name}</p>
            <p className="text-xs text-kumo-subtle">{formatSize(doc.size)}</p>
          </div>
          <Button type="button" size="sm" variant="ghost" loading={busy} onClick={() => input.current?.click()}>
            Replace
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            shape="square"
            icon={<X />}
            aria-label={`Remove ${label}`}
            onClick={() => pick(null)}
          />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-kumo-danger">{error}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-kumo-subtle">{label}</dt>
      <dd className="break-words text-sm text-kumo-default sm:col-span-2">{value || "Not provided"}</dd>
    </div>
  );
}

export default function BecomeATenantPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<TenantApplication>(EMPTY);
  const [errors, setErrors] = useState<StepErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const set = (field: keyof TenantApplication) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: undefined }));
  };

  const docOf = (type: TenantDocType) => form.documents.find((d) => d.type === type);

  const uploadDoc = async (type: TenantDocType, file: File | null) => {
    setErrors((er) => ({ ...er, [type]: undefined }));
    if (!file) {
      setForm((f) => ({ ...f, documents: f.documents.filter((d) => d.type !== type) }));
      return;
    }
    if (!DOC_TYPES.includes(file.type)) {
      setErrors((er) => ({ ...er, [type]: "Please upload a PDF, JPG or PNG file." }));
      return;
    }
    if (file.size > DOC_MAX_BYTES) {
      setErrors((er) => ({ ...er, [type]: "The file must be 10 MB or smaller." }));
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("folder", TENANT_DOC_FOLDER);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
      const doc: TenantDocument = { type, name: file.name, url: data.url, key: data.key, mime: file.type, size: file.size };
      setForm((f) => ({ ...f, documents: [...f.documents.filter((d) => d.type !== type), doc] }));
    } catch (err) {
      setErrors((er) => ({ ...er, [type]: err instanceof Error ? err.message : "Upload failed. Please try again." }));
    }
  };

  const goTo = (next: number) => {
    setStep(next);
    setBanner(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = async () => {
    const stepErrors =
      step === 0 ? checkAccount(form) : step === 1 ? checkBusiness(form, SHOP_CATEGORIES) : step === 2 ? checkDocuments(form.documents) : {};
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      setBanner("Please fix the highlighted fields.");
      return;
    }
    if (step === 0) {
      setBusy(true);
      const { available } = await checkTenantEmailAction(form.email);
      setBusy(false);
      if (!available) {
        setErrors({ email: "An account already uses this email. Sign in instead, or use another email." });
        return;
      }
    }
    goTo(step + 1);
  };

  const submit = async () => {
    if (!agreed) {
      setBanner("Please confirm the details are accurate.");
      return;
    }
    setBusy(true);
    setBanner(null);
    const res = await registerTenantAction(form);
    if (!res.success) {
      setBusy(false);
      setErrors(res.fieldErrors ?? {});
      setBanner(res.error);
      if (typeof res.step === "number") setStep(res.step);
      return;
    }
    login(res.user.id, res.user.name, res.user.email, res.user.role);
    router.replace(res.redirectTo);
  };

  return (
    <>
      <Navbar />
      <main className="bg-kumo-recessed px-4 pb-20 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl">
          <header className="mb-8">
            <h1 className="font-display text-3xl font-semibold text-kumo-default sm:text-4xl">Become a tenant</h1>
            <p className="mt-2 text-kumo-subtle">
              Register your business with SR Mall. Once your account is set up, you can choose a space to rent from your
              tenant dashboard.
            </p>
          </header>

          <Stepper step={step} />

          <section className="mt-8 rounded-xl border border-kumo-line bg-kumo-base p-5 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-kumo-default">{STEPS[step].title}</h2>
            {banner && <Banner variant="error" className="mt-4" description={banner} />}

            <div className="mt-6 space-y-5">
              {step === 0 && (
                <>
                  <Input label="Full name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
                  <Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    description="You'll use this to sign in at the tenant portal."
                    value={form.email}
                    onChange={set("email")}
                    error={errors.email}
                  />
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    description={`At least ${PASSWORD_MIN} characters, with letters and numbers.`}
                    value={form.password}
                    onChange={set("password")}
                    error={errors.password}
                  />
                </>
              )}

              {step === 1 && (
                <>
                  <Input
                    label="Registered business name"
                    description="As shown on your DTI or SEC registration."
                    value={form.companyName}
                    onChange={set("companyName")}
                    error={errors.companyName}
                  />
                  <Input
                    label="Store name"
                    description="The name shoppers will see in the mall directory."
                    value={form.shopName}
                    onChange={set("shopName")}
                    error={errors.shopName}
                  />
                  <Select
                    label="Business category"
                    placeholder="Choose a category"
                    value={form.category || null}
                    onValueChange={(v) => {
                      setForm((f) => ({ ...f, category: (v as string) || "" }));
                      setErrors((er) => ({ ...er, category: undefined }));
                    }}
                    items={Object.fromEntries(SHOP_CATEGORIES.map((c) => [c, c]))}
                    error={errors.category}
                    className="w-full"
                  >
                    {SHOP_CATEGORIES.map((c) => (
                      <Select.Option key={c} value={c}>
                        {c}
                      </Select.Option>
                    ))}
                  </Select>
                  <Input
                    label="Business phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={set("phone")}
                    error={errors.phone}
                  />
                  <Input
                    label="Business address"
                    autoComplete="street-address"
                    description="Your registered address, not the mall unit."
                    value={form.businessAddress}
                    onChange={set("businessAddress")}
                    error={errors.businessAddress}
                  />
                </>
              )}

              {step === 2 && (
                <>
                  <p className="text-sm text-kumo-subtle">PDF, JPG or PNG, up to 10 MB each. Only SR Mall staff can see them.</p>
                  {TENANT_DOCUMENTS.map((d) => (
                    <DocumentField
                      key={d.type}
                      label={d.label}
                      help={d.help}
                      required={d.required}
                      doc={docOf(d.type)}
                      error={errors[d.type]}
                      onChange={(file) => uploadDoc(d.type, file)}
                    />
                  ))}
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-kumo-default">Account</h3>
                      <Button type="button" size="sm" variant="ghost" onClick={() => goTo(0)}>
                        Edit
                      </Button>
                    </div>
                    <dl className="divide-y divide-kumo-line">
                      <ReviewRow label="Full name" value={form.name} />
                      <ReviewRow label="Email" value={form.email} />
                    </dl>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-kumo-default">Business</h3>
                      <Button type="button" size="sm" variant="ghost" onClick={() => goTo(1)}>
                        Edit
                      </Button>
                    </div>
                    <dl className="divide-y divide-kumo-line">
                      <ReviewRow label="Registered name" value={form.companyName} />
                      <ReviewRow label="Store name" value={form.shopName} />
                      <ReviewRow label="Category" value={form.category} />
                      <ReviewRow label="Phone" value={form.phone} />
                      <ReviewRow label="Address" value={form.businessAddress} />
                    </dl>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-kumo-default">Documents</h3>
                      <Button type="button" size="sm" variant="ghost" onClick={() => goTo(2)}>
                        Edit
                      </Button>
                    </div>
                    <dl className="divide-y divide-kumo-line">
                      {TENANT_DOCUMENTS.map((d) => (
                        <ReviewRow key={d.type} label={d.label} value={docOf(d.type)?.name ?? ""} />
                      ))}
                    </dl>
                  </div>
                  <Checkbox
                    label="I confirm these details and documents are accurate and belong to my business."
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                  />
                </>
              )}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-kumo-line pt-5">
              {step > 0 ? (
                <Button type="button" variant="secondary" onClick={() => goTo(step - 1)} disabled={busy}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" variant="primary" onClick={next} loading={busy}>
                  Continue
                </Button>
              ) : (
                <Button type="button" variant="primary" onClick={submit} loading={busy}>
                  Create tenant account
                </Button>
              )}
            </div>
          </section>

          <p className="mt-6 text-center text-sm text-kumo-subtle">
            Already a tenant?{" "}
            <Link href="/tenant-portal" className="text-kumo-link hover:underline">
              Sign in at the tenant portal
            </Link>
          </p>
          {busy && step === STEPS.length - 1 && (
            <div className="mt-4 flex justify-center" aria-live="polite">
              <Loader />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

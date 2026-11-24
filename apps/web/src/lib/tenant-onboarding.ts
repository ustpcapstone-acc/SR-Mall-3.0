/**
 * "Become a Tenant" rules shared by the registration form and the server:
 * the documents we ask for and how each step is checked. Client/server safe.
 */
import { PERMIT_MAX_BYTES, PERMIT_TYPES } from "@/lib/reservation-window";

/** Upload folder for onboarding documents (handled like business permits). */
export const TENANT_DOC_FOLDER = "tenant-documents";
export const DOC_MAX_BYTES = PERMIT_MAX_BYTES;
export const DOC_TYPES = PERMIT_TYPES;

export type TenantDocType = "DTI_SEC" | "BIR_2303" | "VALID_ID" | "BUSINESS_PERMIT";

export const TENANT_DOCUMENTS: { type: TenantDocType; label: string; help: string; required: boolean }[] = [
  {
    type: "DTI_SEC",
    label: "DTI or SEC registration",
    help: "DTI certificate for sole proprietors, SEC registration for partnerships and corporations.",
    required: true,
  },
  {
    type: "BIR_2303",
    label: "BIR Certificate of Registration (Form 2303)",
    help: "Shows your TIN and registered business address.",
    required: true,
  },
  {
    type: "VALID_ID",
    label: "Valid government ID",
    help: "Of the owner or authorized representative.",
    required: true,
  },
  {
    type: "BUSINESS_PERMIT",
    label: "Mayor's or business permit",
    help: "Optional for now. Upload it if you already have one.",
    required: false,
  },
];

export type TenantDocument = { type: TenantDocType; name: string; url: string; key?: string; mime: string; size: number };

export type TenantApplication = {
  // Step 1: account
  name: string;
  email: string;
  password: string;
  // Step 2: business
  companyName: string;
  shopName: string;
  category: string;
  phone: string;
  businessAddress: string;
  // Step 3: documents
  documents: TenantDocument[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{6,19}$/;
export const PASSWORD_MIN = 8;

export type StepErrors = Partial<Record<keyof TenantApplication | TenantDocType, string>>;

export function checkAccount(a: Pick<TenantApplication, "name" | "email" | "password">): StepErrors {
  const e: StepErrors = {};
  if (a.name.trim().length < 2) e.name = "Enter your full name.";
  if (!EMAIL_RE.test(a.email.trim())) e.email = "Enter a valid email address.";
  if (a.password.length < PASSWORD_MIN) e.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (!/[A-Za-z]/.test(a.password) || !/\d/.test(a.password)) e.password = "Use letters and numbers.";
  return e;
}

export function checkBusiness(
  a: Pick<TenantApplication, "companyName" | "shopName" | "category" | "phone" | "businessAddress">,
  categories: readonly string[],
): StepErrors {
  const e: StepErrors = {};
  if (a.companyName.trim().length < 2) e.companyName = "Enter the registered business name.";
  if (a.shopName.trim().length < 2) e.shopName = "Enter the store name shoppers will see.";
  if (!categories.includes(a.category)) e.category = "Choose a category.";
  if (!PHONE_RE.test(a.phone.trim())) e.phone = "Enter a valid phone number.";
  if (a.businessAddress.trim().length < 8) e.businessAddress = "Enter the full business address.";
  return e;
}

/** URL/key checks mirror the business-permit rules in actions/space-slot.ts. */
const DOC_KEY_RE = new RegExp(
  `^cloudinary:(raw|image):${TENANT_DOC_FOLDER}/[\\w\\-./]+$|^local:${TENANT_DOC_FOLDER}/[\\w\\-.]+$`,
);

export function isValidDocument(d: TenantDocument | undefined): boolean {
  return (
    !!d &&
    TENANT_DOCUMENTS.some((t) => t.type === d.type) &&
    typeof d.url === "string" &&
    (/^https:\/\//i.test(d.url) || d.url.startsWith(`/uploads/${TENANT_DOC_FOLDER}/`)) &&
    DOC_TYPES.includes(d.mime) &&
    Number(d.size) > 0 &&
    Number(d.size) <= DOC_MAX_BYTES &&
    (!d.key || DOC_KEY_RE.test(d.key))
  );
}

export function checkDocuments(docs: TenantDocument[]): StepErrors {
  const e: StepErrors = {};
  for (const t of TENANT_DOCUMENTS) {
    const doc = docs.find((d) => d.type === t.type);
    if (doc && !isValidDocument(doc)) e[t.type] = "This file can't be used. Upload it again.";
    else if (!doc && t.required) e[t.type] = "Required.";
  }
  return e;
}

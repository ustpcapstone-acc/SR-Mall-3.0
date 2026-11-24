# SR Mall Rebuild: Instructions for Claude Code

Read this whole file before starting. Work one phase at a time (see "Phases" at the end). After each phase, review the changes, then push to `main` (Vercel is the live host).

---

## 0. Global rules (apply to everything)

- **Never use em dashes** in code comments, UI text, docs, or commit messages. Use commas, colons, or periods.
- **No decorative tags or pills** such as "Top Picks", "Premium Collection", "Featured Campaign", "New", "Hot".
- **UI components:** use Cloudflare Kumo (`@cloudflare/kumo`, https://github.com/cloudflare/kumo) for every new or rebuilt screen. Convert remaining screens in the final phase.
- **Writing style:** follow the Ponytail skill (https://github.com/dietrichgebert/ponytail). Install it if it is missing. If it cannot be installed, follow its rules anyway: smallest change that works, reuse existing code first, no unnecessary dependencies, keep validation, security, and accessibility intact.
- Enforce every permission **on the server** (API routes and database policies), not only by hiding sidebar items.

---

## 1. Account types

There are exactly four account types. They are fully separate.

| Account type | Count | Login page | Created by |
|---|---|---|---|
| Superuser | Exactly 1 | `/staff-portal` | Seeded once. Cannot be created, deleted, or demoted from the UI. |
| Staff | Many | `/staff-portal` | The superuser (or staff with the "Manage staff" permission) |
| Tenant | Many | `/tenant-portal` | Self sign-up through "Become a Tenant" |
| Customer (user) | Many | `/login` | Normal self sign-up |

Rules:
- Each login page only accepts its own account type. A wrong type gets a clear error such as "This account cannot sign in here." Do not reveal whether the email exists.
- One account has exactly one account type. Account types are never converted.
- The superuser always has every permission and does not need a role.

### 1.1 Making someone staff (decision: separate staff account)

There is **no "promote" button**. To give a person staff access:

1. Superuser creates (or picks) a **role**, for example "Tenant Monitor" with only **Tenant Monitoring** ticked.
2. Superuser creates a **new staff account** for that person (email, name, temporary password or invite link) and assigns the role.
3. The person signs in at `/staff-portal` and sees only the sections their role allows. Any other section is hidden in the sidebar and blocked by the server (403).

Notes:
- The staff account is independent of any customer account the person may already have. Their customer account keeps working at `/login`.
- The staff account should use a different email from their customer account. If the email is already used by a customer or tenant account, block it with a clear message.
- Removing staff access (deactivate account or change role) never affects their customer account.

---

## 2. Admin side (`/staff-portal`)

### 2.1 Roles and permissions (RBAC)
- New sidebar item: **Roles & Staff**.
- Create, edit, and delete roles. Each role has a name and a checklist of permissions.
- Each permission opens one admin section (full use of that section). The list lives in `apps/web/src/lib/permissions.ts`: Dashboard, Bookings, Floor Spaces & Map, Messages, Complaints, Tenant Monitoring, Ad Scheduler, User Management, Public-View CMS, Roles & Staff. Later phases add their own sections there (Rent Requests, Renewals, Payments & Invoices).
- Staff with the Roles & Staff permission can only grant sections they can open themselves, and can never change the superuser.
- Roles can only be assigned to **staff** accounts.
- A role cannot be deleted while staff are assigned to it (ask to reassign first).

### 2.2 Rent Requests
- Tenants request a space from their Home workspace. The request appears here as **Pending**.
- Tenants pay on site. When admin has collected the payment, admin clicks **Approve** and records the amount, payment date, and method.
- Approving:
  1. Assigns the space to the tenant (creates the lease with start date, end date, and rent amount).
  2. Marks the space as **occupied**.
  3. Automatically issues an **e-invoice** (marked as paid) and sends it to the tenant.
  4. Creates the tenant's new workspace for that space.
- Admin can also **Reject** with a reason, which is shown to the tenant.

### 2.3 Renewals (new sidebar item)
- Lists leases that are upcoming, due, in grace period, and overdue.
- **Settings (admin-configurable):**
  - Reminder schedule: how many days before the due date to notify (for example 7 days and 1 day).
  - Grace period length in days (for example 3 or 10).
  - Notices during the grace period.
- When admin records a renewal payment, the lease extends and an e-invoice is issued automatically (same as 2.2).
- If the tenant has not paid by the end of the grace period:
  1. The tenant is removed from the space automatically (lease ends).
  2. The space becomes **available** again.
  3. The tenant is notified, and the workspace for that space becomes read-only or archived.
- The tenant is notified at every step: reminder, due date, grace period start, final warning, removal.
- Run this with a scheduled job (cron), not on page load.

### 2.4 E-invoices
- Each invoice has an invoice number, tenant, space, billing period, line items, total, status (Paid, Due, Overdue, Void), issue date, and paid date.
- Can be downloaded as a PDF and is visible to the tenant.

---

## 3. Tenant side (`/tenant-portal`)

### 3.1 "Become a Tenant" onboarding
- Add a **Become a Tenant** button to the landing page navbar. It links to the tenant registration page.
- Registration is a **stepper form**:
  1. Account: email, password (this is the `/tenant-portal` login).
  2. Company: company name, contact person, phone, address, business type.
  3. Documents: upload the required business documents.
  4. Review and submit.
- Validate each step before going to the next one.

### 3.2 Workspaces
- The sidebar has a **workspace dropdown**.
- **Home** (default workspace): Dashboard, Messages, Rent a Space (browse available spaces and send a rent request).
- **One workspace per approved space**: Overview, Storefront, Ads & Promos, Messages, Payments, Reviews & Complaints, Staff.
- Messages belong to their workspace. Home messages do not appear in a space workspace, and space messages do not appear in Home.
- Existing tenant shops become each tenant's first space workspace (migrate the data).

### 3.3 Payments page (per space)
- At the top: **next payment due date** and **next amount due**, plus lease status.
- Table of invoices and payment history: **paginated**, sortable by date, filterable by status, with PDF download for each e-invoice.
- Model it on large company billing pages (clear summary, clean table, receipt downloads).

### 3.4 Tenant staff and roles (per space)
- Same idea as admin RBAC, but limited to one space workspace.
- Comes with built-in default roles (for example Manager, Cashier, Marketing). The tenant can add custom roles and tick permissions for that space's sections.
- The tenant can add staff to the space and assign them roles. Tenant staff only see that space.

---

## 4. Customer side (`/login`)
- A customer dashboard with content that suits a shopper (for example bookings, saved shops, recent activity, promotions from mall tenants) and Messages.

---

## 5. Landing page and navbar
- Better performance (optimized images, lazy loading, fewer blocking scripts).
- Animations in the hero and the sections below it (respect `prefers-reduced-motion`).
- Content focused on SR Mall itself: the mall, its tenants, ads, and marketing.
- Formal, readable typography across the whole site.
- A cleaner navbar that includes the **Become a Tenant** button and links to the right login pages.

---

## Phases (do in order)

1. Foundations: Tailwind v4, Kumo setup, typography.
2. Account types, RBAC, the three login portals, staff accounts (section 1 and 2.1).
3. Tenant onboarding stepper (3.1).
4. Leasing: multiple spaces, rent requests, e-invoices, renewals with grace period (2.2 to 2.4).
5. Tenant workspaces, tenant RBAC, payments page (3.2 to 3.4).
6. Customer dashboard (4).
7. Landing page and navbar, then finish converting remaining screens to Kumo (5).

At the end of each phase: run the build and tests, review the diff, then push to `main`.

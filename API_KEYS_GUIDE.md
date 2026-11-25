# 🔐 SR-Mall API Keys & Environment Variables Guide

This guide provides a comprehensive list of all API keys and environment variables required to run the **SR-Mall 3.0** platform. Share this with your development team to ensure everyone has the correct credentials.

---

## 📂 Environment File Setup

The project now uses a single **Unified Environment File** at the root of the project.

1.  **File Location**: `/.env` (Root directory)
2.  **Usage**: All applications (Web, Database) will read from this single file.

---

## 🚀 Required Variables

| Category | Variable | Description | Value |
| :--- | :--- | :--- | :--- |
| **Database** | `DATABASE_URL` | PostgreSQL connection string | `postgresql://USER:PASSWORD@HOST:5432/postgres` |
| **App** | `NEXT_PUBLIC_APP_URL` | The base URL of your application | `http://192.168.0.133:3000` |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://caywuflktxjcvxafbmnt.supabase.co` |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase project Anon/Public key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (See .env) |
| **Cloudinary** | `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | `dpg3ooznl` |
| **Cloudinary** | `CLOUDINARY_API_KEY` | Cloudinary API Key | `your-cloudinary-api-key` |
| **Cloudinary** | `CLOUDINARY_API_SECRET` | Cloudinary secret Key | `your-cloudinary-api-secret` |
| **Gmail** | `GMAIL_USER` | Your Gmail address | `jerickaradilla76@gmail.com` |
| **Gmail** | `GMAIL_APP_PASSWORD` | 16-character App Password | `your-gmail-app-password` |

---

## 🛠️ Detailed Setup Instructions

### 1. Database (Prisma)
The project uses Prisma as an ORM.
- **Local Development**: `postgresql://USER:PASSWORD@HOST:5432/postgres`
- **Action**: Ensure Docker is running or you have a local Postgres instance on port 5435.

### 2. Supabase (Auth & Realtime)
Supabase handles user authentication and database hosting (if not local).
- **URL**: `https://caywuflktxjcvxafbmnt.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNheXd1ZmxrdHhqY3Z4YWZibW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MDQ1MzQsImV4cCI6MjA3OTM4MDUzNH0.6z7EOj_t9eakulcAMuw3_1-733nWTpDxYPN94qLSbv8`

### 3. Cloudinary (Asset Storage)
Used for uploading images of stores, products, and ads.
- **Cloud Name**: `dpg3ooznl`
- **API Key**: `your-cloudinary-api-key`
- **API Secret**: `your-cloudinary-api-secret`
- **Upload Preset**: `ml_default`

### 4. Gmail (Notifications)
Used for sending automated emails to tenants and admins.
- **User**: `jerickaradilla76@gmail.com`
- **App Password**: `your-gmail-app-password`

---

## 📝 Template (.env.full)

Copy the following into your `.env` and `apps/web/.env.local` files:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# App
NEXT_PUBLIC_APP_URL="http://192.168.0.133:3000"
NODE_ENV="development"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://caywuflktxjcvxafbmnt.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-next-public-supabase-anon-key"

# Cloudinary
CLOUDINARY_CLOUD_NAME="dpg3ooznl"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="dpg3ooznl"
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="ml_default"

# Gmail
GMAIL_USER="jerickaradilla76@gmail.com"
GMAIL_APP_PASSWORD="your-gmail-app-password"
```


---

> [!TIP]
> Never commit actual `.env` files with real keys to GitHub. Always use `.env.example` as a template for other developers.

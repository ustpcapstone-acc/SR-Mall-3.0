import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Check env vars
  results.env = {
    GMAIL_USER: process.env.GMAIL_USER ? `✅ Set (${process.env.GMAIL_USER})` : "❌ MISSING",
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD
      ? `✅ Set (length: ${process.env.GMAIL_APP_PASSWORD.length})`
      : "❌ MISSING",
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID ? "✅ Set" : "⚠️ Not set (App Password fallback will be used)",
    DATABASE_URL: process.env.DATABASE_URL
      ? `✅ Set (${process.env.DATABASE_URL.substring(0, 60)}...)`
      : "❌ MISSING",
  };

  // 2. Test database - PasswordResetToken table
  try {
    const { prisma } = await import("@srmall/database");
    const count = await prisma.passwordResetToken.count();
    results.database = { status: "✅ Connected", passwordResetTokenTableExists: true, tokenCount: count };
  } catch (e: any) {
    results.database = { status: "❌ Error", error: e?.message || String(e) };
  }

  // 3. Test Gmail SMTP
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    await transporter.verify();
    results.gmail = { status: "✅ Gmail SMTP verified successfully" };
  } catch (e: any) {
    results.gmail = { status: "❌ Gmail SMTP failed", error: e?.message || String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}

import { NextResponse } from 'next/server';
import { sendGmail } from '@/lib/gmail';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Target of a Supabase database webhook. The webhook must send the header
 * "Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>"; without that variable set
 * every call is refused.
 */
export async function POST(req: Request) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await req.json();
    
    // Supabase Webhook payload structure for INSERT on auth.users
    const { record, type, table, schema } = payload;

    // Validate that this is an insert event on the auth.users table
    if (type !== 'INSERT' || table !== 'users' || schema !== 'auth') {
      // If it's not a new user registration, we skip it
      return NextResponse.json({ 
        success: false, 
        message: 'Ignore: Not an auth.users insert event' 
      });
    }

    if (!record) {
      return NextResponse.json({ success: false, message: 'No record found' }, { status: 400 });
    }

    const { email, raw_user_meta_data } = record;
    
    // Extract user's name from metadata (set by Google OAuth or manual signup)
    const name = raw_user_meta_data?.full_name || 
                 raw_user_meta_data?.name || 
                 email.split('@')[0];

    // Send the Welcome Email
    await sendGmail({
      to: email,
      subject: 'Welcome to SR-MANAGE!',
      text: `Hello ${name}, thank you for logging in to SR-MANAGE. You can now access your dashboard.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #BE1E2D;">Welcome to SR-MANAGE!</h2>
          <p>Hello <strong>${escapeHtml(String(name))}</strong>,</p>
          <p>Thank you for logging in to SR-MANAGE. We're excited to have you on board!</p>
          <p>You can now access your dashboard and explore all the features we offer for property and mall management.</p>
          <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #777;">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>SR Mall Management Team</p>
          </div>
        </div>
      `
    });

    console.log(`[WELCOME_EMAIL]: Sent successfully to ${email}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Welcome email sent successfully' 
    });

  } catch (error: any) {
    console.error('[SEND_WELCOME_EMAIL_ERROR]:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An error occurred while sending the email' 
    }, { status: 500 });
  }
}

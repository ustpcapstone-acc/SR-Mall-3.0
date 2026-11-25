import { NextResponse } from 'next/server';
import { sendNotifyEmail, type NotifyPayload } from '@/lib/notify-email';
import { denyUnlessSuperuser } from '@/lib/route-guard';

/**
 * Superuser only: it sends mall email to any address. The app itself calls
 * sendNotifyEmail from server actions, after their own access checks.
 */
export async function POST(req: Request) {
  const denied = await denyUnlessSuperuser();
  if (denied) return denied;

  try {
    const payload: NotifyPayload = await req.json();
    await sendNotifyEmail(payload);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email Dispatch Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

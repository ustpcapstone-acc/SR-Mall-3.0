import { NextResponse } from 'next/server';
import { prisma } from '@srmall/database';
import { emailBaseUrl } from '@/utils/get-base-url';
import { sendGmail } from '@/lib/gmail';

// Email Template Generator
const createEmailHTML = (title: string, content: string, ctaLink?: string, ctaText?: string) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f4f4f5;
        margin: 0;
        padding: 0;
        color: #3f3f46;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      .header {
        background-color: #BE1E2D;
        padding: 24px;
        text-align: center;
        color: #ffffff;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
      .content {
        padding: 32px;
      }
      .content h2 {
        color: #18181b;
        font-size: 20px;
        margin-top: 0;
      }
      .content p {
        line-height: 1.6;
        margin-bottom: 24px;
      }
      .cta-wrapper {
        text-align: center;
        margin: 32px 0;
      }
      .cta-button {
        display: inline-block;
        background-color: #BE1E2D;
        color: #ffffff !important;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: 500;
        font-size: 16px;
      }
      .footer {
        background-color: #f4f4f5;
        padding: 24px;
        text-align: center;
        font-size: 13px;
        color: #71717a;
        border-top: 1px solid #e4e4e7;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>SR Mall</h1>
      </div>
      <div class="content">
        <h2>${title}</h2>
        ${content}
        ${ctaLink && ctaText ? `
        <div class="cta-wrapper">
          <a href="${ctaLink}" class="cta-button">${ctaText}</a>
        </div>
        ` : ''}
      </div>
      <div class="footer">
        <p>This is an automated message. <strong>Please do not reply to this email.</strong></p>
        <p>SR Mall Management Office</p>
      </div>
    </div>
  </body>
  </html>
`;

export interface NotifyPayload {
  type: 'BILL_POSTED' | 'PAYMENT_CONFIRMED' | 'GENERAL_ANNOUNCEMENT' | 'ACCOUNT_CREATED' | 'ADMIN_NEW_USER_ALERT';
  email?: string;
  data?: {
    unitId?: string;
    shopName?: string;
    amount?: number;
    month?: string;
    referenceNo?: string;
    subject?: string;
    message?: string;
    portalUrl?: string;
    name?: string;
    email?: string;
  };
}

export async function POST(req: Request) {
  try {
    const payload: NotifyPayload = await req.json();
    const { type, email, data } = payload;

    // Links in these emails open the live site (see EMAIL_BASE_URL).
    const appUrl = emailBaseUrl();
    const tenantPortalUrl = `${appUrl}/tenantdashboard/lease-payments`;

    let options: any = { to: email };

    if (type === 'BILL_POSTED') {
      const formattedAmount = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(data?.amount || 0);
      options.subject = 'New Billing Statement - SR Mall';
      options.html = createEmailHTML(
        'New Billing Statement Posted',
        `<p>Dear Tenant (<strong>${data?.shopName || 'Shop'}</strong> - Unit: <strong>${data?.unitId}</strong>),</p>
         <p>A new billing statement for <strong>${data?.month}</strong> has been posted.</p>
         <p><strong>Amount Due:</strong> ${formattedAmount}</p>`,
        tenantPortalUrl,
        'Go to Tenant Portal'
      );
    } else if (type === 'PAYMENT_CONFIRMED') {
      options.subject = 'Payment Confirmed - Thank You';
      options.html = createEmailHTML(
        'Payment Successfully Confirmed',
        `<p>Dear Tenant (<strong>${data?.shopName || 'Shop'}</strong>),</p>
         <p>We have verified your payment.</p>
         <p><strong>Reference Number:</strong> ${data?.referenceNo}</p>`,
        tenantPortalUrl,
        'View Account Status'
      );
    } else if (type === 'GENERAL_ANNOUNCEMENT') {
      const tenants = await (prisma as any).tenant.findMany({ include: { user: true } });
      const emails = tenants.map((t: any) => t.user?.email).filter((e: any) => e);
      options.to = process.env.GMAIL_USER || '';
      options.bcc = emails;
      options.subject = `Announcement: ${data?.subject}`;
      options.html = createEmailHTML(data?.subject || 'Announcement', `<p>${data?.message}</p>`);
    } else if (type === 'ACCOUNT_CREATED') {
      options.subject = 'Welcome to SR Mall!';
      options.html = createEmailHTML(
        'Welcome to the SR Mall Family',
        `<p>Dear <strong>${data?.name}</strong>,</p><p>Your account has been created.</p>`,
        `${appUrl}/public-view`,
        'Visit SR Mall'
      );
    } else if (type === 'ADMIN_NEW_USER_ALERT') {
      options.to = process.env.GMAIL_USER || '';
      options.subject = 'New User Registered - SR Mall';
      options.html = createEmailHTML(
        'New Member Registration',
        `<p>New user: ${data?.name} (${data?.email})</p>`
      );
    }

    await sendGmail(options);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Email Dispatch Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

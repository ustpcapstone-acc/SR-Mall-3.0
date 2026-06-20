import { google } from 'googleapis';
import nodemailer from 'nodemailer';

/**
 * Gmail Service Utility
 * Supports both standard Nodemailer (App Password) 
 * and Gmail API (OAuth2) with Refresh Token.
 */

export async function sendGmail(options: {
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const { to, cc, subject, text, html } = options;

  // ─── Option 1: Gmail API (OAuth2) ───
  // Preferred for security and long-term background usage
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const user = process.env.GMAIL_USER;

  if (clientId && clientSecret && refreshToken && user) {
    try {
      const OAuth2 = google.auth.OAuth2;
      const oauth2Client = new OAuth2(
        clientId,
        clientSecret,
        "https://developers.google.com/oauthplayground" // Standard redirect URL
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const accessToken = await new Promise<string>((resolve, reject) => {
        oauth2Client.getAccessToken((err, token) => {
          if (err) reject("Failed to create access token :(");
          resolve(token as string);
        });
      });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: user,
          clientId: clientId,
          clientSecret: clientSecret,
          refreshToken: refreshToken,
          accessToken: accessToken
        }
      } as any);

      await transporter.sendMail({
        from: `"SR Mall" <${user}>`,
        to,
        cc,
        subject,
        text,
        html,
      });

      return { success: true, method: 'OAuth2' };
    } catch (error) {
      console.error("[GMAIL_API_ERROR]:", error);
      // Fallback to App Password if OAuth2 fails
    }
  }

  // ─── Option 2: Nodemailer (App Password) ───
  // Current working method using GMAIL_APP_PASSWORD
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (user && appPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user,
          pass: appPassword,
        },
      });

      await transporter.sendMail({
        from: `"SR Mall" <${user}>`,
        to,
        cc,
        subject,
        text,
        html,
      });

      return { success: true, method: 'AppPassword' };
    } catch (error) {
      console.error("[GMAIL_NODEMAILER_ERROR]:", error);
      throw error;
    }
  }

  throw new Error("No valid Gmail credentials found (App Password or OAuth2).");
}

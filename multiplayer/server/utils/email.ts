import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured - emails will be logged to console');
    return null;
  }

  resend = new Resend(apiKey);
  return resend;
}

export async function sendMagicLinkEmail(
  email: string,
  username: string,
  token: string
): Promise<boolean> {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const verifyUrl = `${appUrl}/api/auth/verify?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Log in to Big Two</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d4a2a; padding: 40px 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.5);">
        <div style="background: linear-gradient(135deg, #d4af37 0%, #a68928 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: #1a1a1a; font-size: 28px;">🎴 Big Two</h1>
        </div>
        <div style="padding: 40px 30px;">
          <p style="color: #ffffff; font-size: 18px; margin: 0 0 10px;">Hey ${username}!</p>
          <p style="color: rgba(255,255,255,0.7); font-size: 16px; margin: 0 0 30px;">
            Click the button below to log in to Big Two. This link expires in 15 minutes.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}"
               style="display: inline-block; background: linear-gradient(180deg, #d4af37 0%, #a68928 100%); color: #1a1a1a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
              Log In to Big Two
            </a>
          </div>
          <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 30px 0 0; text-align: center;">
            If you didn't request this email, you can safely ignore it.
          </p>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 20px 30px; text-align: center;">
          <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 0;">
            Big Two Multiplayer • Card Game
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const client = getResend();

  if (!client) {
    // Development mode - log to console
    console.log('\n' + '='.repeat(60));
    console.log('📧 MAGIC LINK EMAIL (dev mode)');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Subject: Log in to Big Two`);
    console.log(`\nVerify URL: ${verifyUrl}`);
    console.log('='.repeat(60) + '\n');
    return true;
  }

  try {
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM || 'Big Two <noreply@bigtwo.dev>',
      to: email,
      subject: 'Log in to Big Two',
      html
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return false;
    }

    console.log(`[Email] Sent magic link to ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

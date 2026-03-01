// backend/src/common/email.ts
import { Resend } from 'resend';
import { config } from '../config.js';

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

export async function sendInviteEmail(
  to: string,
  schoolName: string,
  inviterEmail: string,
  inviteUrl: string
) {
  if (!resend) {
    console.log(`[Email] No RESEND_API_KEY configured. Invite URL: ${inviteUrl}`);
    return;
  }

  try {
    const result = await resend.emails.send({
      from: 'AthleticOS <noreply@athleticos.co>',
      to,
      subject: `You've been invited to ${schoolName} on AthleticOS`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're invited!</h2>
          <p><strong>${inviterEmail}</strong> has invited you to join <strong>${schoolName}</strong> on AthleticOS.</p>
          <p style="margin: 24px 0;">
            <a href="${inviteUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Accept Invite
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This invite expires in 7 days. If you didn't expect this, you can ignore this email.</p>
        </div>
      `,
    });
    console.log('[Email] Sent invite email:', JSON.stringify(result));
  } catch (err) {
    console.error('[Email] Failed to send invite email:', err);
  }
}

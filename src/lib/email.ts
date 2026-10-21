import nodemailer from "nodemailer";

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends a real email using SMTP configuration.
 * Falls back to console log simulation if credentials are not configured in environment variables.
 */
export async function sendEmail({ to, subject, text, html }: MailOptions) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"AgentForge" <noreply@agentforge.com>`;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(
      `[EMAIL SERVICE] SMTP configuration is missing in .env (SMTP_HOST, SMTP_USER, SMTP_PASS). Falling back to console simulation.`
    );
    console.log(`\n======================================================`);
    console.log(`[EMAIL DISPATCH SIMULATION]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${text}`);
    console.log(`======================================================\n`);
    return { success: false, info: "SMTP credentials not configured. Logged to console." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailPayload: nodemailer.SendMailOptions = {
      from: smtpFrom,
      to,
      subject,
      text,
    };

    if (html) {
      mailPayload.html = html;
    }

    const info = await transporter.sendMail(mailPayload);

    console.log(`[EMAIL SERVICE] Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[EMAIL SERVICE] Failed to send email to ${to}:`, err);
    throw err;
  }
}

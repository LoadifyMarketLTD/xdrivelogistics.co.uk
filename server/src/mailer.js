/**
 * Email service using nodemailer
 * Falls back to console logging when SMTP is not configured (dev mode)
 */
import nodemailer from 'nodemailer';

// Check if SMTP is configured
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER;

let transporter;

if (isSmtpConfigured) {
  // Real SMTP transport
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('✓ Email service configured with SMTP');
} else {
  // Development mode - log emails to console
  transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
  console.log('⚠ Email service in LOG mode (SMTP not configured)');
}

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 */
export async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@xdrivelogistics.co.uk',
    to: email,
    subject: 'Verify your XDrive account',
    text: `Please verify your account by visiting: ${verifyUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f172a;">Verify Your XDrive Account</h2>
        <p>Thank you for registering with XDrive Logistics.</p>
        <p>Please click the link below to verify your email address:</p>
        <p style="margin: 20px 0;">
          <a href="${verifyUrl}" style="background: #d9a85c; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">This link will expire in 60 minutes.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    
    if (!isSmtpConfigured) {
      // Log mode - display the verification link
      console.log('\n═══════════════════════════════════════');
      console.log('📧 EMAIL VERIFICATION (DEV MODE)');
      console.log('═══════════════════════════════════════');
      console.log(`To: ${email}`);
      console.log(`Verification Link: ${verifyUrl}`);
      console.log('═══════════════════════════════════════\n');
    }
    
    return info;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export default transporter;

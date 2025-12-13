/**
 * Email service using nodemailer
 * - SendGrid configuration example in .env.example
 * - Falls back to logging if SMTP not configured (dev mode)
 */
const nodemailer = require('nodemailer');

let transporter;

// Check if SMTP is configured
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

if (isSmtpConfigured) {
  // Real SMTP transport (SendGrid or other)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('✅ Email transport configured with SMTP');
} else {
  // Dev/log fallback - just logs emails instead of sending
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('📧 [DEV MODE] Email would be sent:');
      console.log('  To:', mailOptions.to);
      console.log('  Subject:', mailOptions.subject);
      console.log('  Text:', mailOptions.text);
      console.log('  HTML:', mailOptions.html);
      return { messageId: 'dev-mode-' + Date.now() };
    },
  };
  console.log('⚠️  SMTP not configured - emails will be logged only');
}

/**
 * Send verification email
 */
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"XDrive Logistics" <noreply@xdrivelogistics.co.uk>',
      to: email,
      subject: 'Verify your XDrive account',
      text: `Please verify your account: ${verifyUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to XDrive Logistics!</h2>
          <p>Please verify your account by clicking the link below:</p>
          <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #D6A551; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
          <p>Or copy and paste this link: ${verifyUrl}</p>
          <p>This link expires in 60 minutes.</p>
        </div>
      `,
    });
    return info;
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw error;
  }
}

module.exports = {
  transporter,
  sendVerificationEmail,
};

/**
 * Email service using nodemailer
 * - SendGrid configuration example in .env.example
 * - Falls back to logging if SMTP not configured (dev mode)
 */
const nodemailer = require('nodemailer');

// Check if SMTP is configured
const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

let transporter;

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
      if (mailOptions.html) {
        // Extract URL from HTML for easier copying
        const urlMatch = mailOptions.html.match(/href="([^"]+)"/);
        if (urlMatch) {
          console.log('  Link:', urlMatch[1]);
        }
      }
      return { messageId: 'dev-mode-log', accepted: [mailOptions.to] };
    }
  };
  console.warn('⚠️  SMTP not configured. Emails will be logged to console.');
}

/**
 * Send email verification link
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @returns {Promise<object>} - Nodemailer result
 */
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/verify-email?token=${encodeURIComponent(token)}`;
  
  const emailContent = {
    from: process.env.EMAIL_FROM || 'noreply@xdrivelogistics.co.uk',
    to: email,
    subject: 'Verify your XDrive account',
    text: `Please verify your account by clicking this link: ${verifyUrl}\n\nThis link will expire in 1 hour.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to XDrive Logistics!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="background-color: #D6A551; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link will expire in 1 hour.</p>
      </div>
    `,
  };
  
  return await transporter.sendMail(emailContent);
}

module.exports = {
  transporter,
  sendVerificationEmail,
};

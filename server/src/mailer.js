/**
 * Email service using nodemailer
 * Logs verification links to console if SMTP not configured
 */
const nodemailer = require('nodemailer');

// Create transporter with SMTP config or ethereal for testing
let transporter;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Fallback: log only mode
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('📧 Email would be sent:');
      console.log('   To:', mailOptions.to);
      console.log('   Subject:', mailOptions.subject);
      console.log('   Body:', mailOptions.text || mailOptions.html);
      return { messageId: 'logged-only' };
    },
  };
  console.log('⚠️  SMTP not configured - emails will be logged to console');
}

/**
 * Send verification email
 */
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/verify-email.html?token=${encodeURIComponent(token)}`;
  
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@xdrivelogistics.co.uk',
    to: email,
    subject: 'Verify your XDrive account',
    text: `Please verify your account: ${verifyUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to XDrive Logistics!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="background-color: #D6A551; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link will expire in 1 hour.</p>
      </div>
    `,
  });
  
  return info;
}

module.exports = {
  sendVerificationEmail,
  transporter,
};

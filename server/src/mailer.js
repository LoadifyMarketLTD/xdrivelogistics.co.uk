/**
 * Nodemailer transport configuration
 */
const nodemailer = require('nodemailer');

// Create transporter based on environment variables
function createTransporter() {
  // If SMTP credentials are not configured, use a test transport that logs to console
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('⚠️  SMTP not configured. Emails will be logged to console instead.');
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const transporter = createTransporter();

/**
 * Send verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 */
async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
  
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"XDrive Logistics" <no-reply@xdrivelogistics.co.uk>',
      to: email,
      subject: 'Verify your XDrive account',
      text: `Please verify your account: ${verifyUrl}`,
      html: `
        <h2>Welcome to XDrive Logistics</h2>
        <p>Please verify your account by clicking the link below:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link will expire in ${process.env.VERIFY_TOKEN_EXPIRES_MIN || 60} minutes.</p>
      `,
    });

    // If using console transport, log the email
    if (info.message) {
      console.log('📧 Email (not sent, logged):', info.message.toString());
    } else {
      console.log('📧 Email sent:', info.messageId);
    }

    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw error;
  }
}

module.exports = {
  transporter,
  sendVerificationEmail,
};

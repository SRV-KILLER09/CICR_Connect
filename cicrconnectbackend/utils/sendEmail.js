const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error("Gmail credentials (GMAIL_USER and GMAIL_APP_PASSWORD) are not configured");
  }

  // Create a transporter using Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"CICR Connect" <${process.env.GMAIL_USER}>`,
    to: options.email || options.to || process.env.GMAIL_USER, // default to self if bulk sending via BCC
    bcc: options.bcc, // Array or comma-separated string of emails
    subject: options.subject,
    html: options.message,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Email sent via Gmail:", info.messageId);
  return info;
};

module.exports = sendEmail;

const nodemailer = require("nodemailer");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = "Tickets <no-reply@example.com>",
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 587),
  secure: false, // TLS via STARTTLS on 587
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

async function sendMail({ to, subject, html, attachments = [], replyTo }) {
  return transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    html,
    attachments,
    replyTo,
  });
}

module.exports = { sendMail };

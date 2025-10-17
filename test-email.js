require('dotenv').config();
const { sendMail } = require('./utils/mailer');

(async () => {
  try {
    const info = await sendMail({
      to: process.env.SMTP_USER, // send to yourself first
      subject: "Test: Gmail SMTP via App Password",
      html: "<p>It works! ✅</p>",
    });
    console.log("Sent:", info.messageId);
  } catch (e) {
    console.error("Email failed:", e);
  }
})();

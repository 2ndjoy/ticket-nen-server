const dayjs = require("dayjs");

function ticketEmailHtml({ event, booking }) {
  const dateStr = dayjs(event.date).isValid()
    ? dayjs(event.date).format("dddd, MMMM D, YYYY")
    : String(event.date || "");
  const timeStr = event.time || "TBA";
  const locStr = event.location || "TBA";

  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; line-height:1.6">
    <h2 style="margin:0 0 12px; color:#0b7253;">Your Ticket is Confirmed 🎟️</h2>
    <p>Hi ${booking.name || "there"},</p>
    <p>Thanks for your purchase! Your ticket is attached as a PDF. Show it at the entrance (or the QR code within it) for verification.</p>

    <div style="border:1px solid #eee; padding:12px 16px; border-radius:6px; background:#fafafa; margin:16px 0;">
      <h3 style="margin:0 0 8px;">${event.title || "Event"}</h3>
      ${event.subtitle ? `<p style="margin:0 0 8px; color:#555;">${event.subtitle}</p>` : ""}
      <p style="margin:0;"><strong>Date:</strong> ${dateStr}</p>
      <p style="margin:0;"><strong>Time:</strong> ${timeStr}</p>
      <p style="margin:0;"><strong>Venue:</strong> ${locStr}</p>
    </div>

    <div style="margin-top:12px;">
      <p style="margin:0;"><strong>Ticket Type:</strong> ${String(booking.ticketType || "-").toUpperCase()}</p>
      <p style="margin:0;"><strong>Quantity:</strong> ${booking.quantity || 1}</p>
      <p style="margin:0;"><strong>Amount Paid:</strong> ৳${Number(booking.amount || 0).toLocaleString("bn-BD")}</p>
      <p style="margin:0;"><strong>Booking ID:</strong> ${booking._id}</p>
    </div>

    <p style="margin-top:16px; color:#666;">If you have any questions, just reply to this email.</p>
    <p style="margin:0; color:#0b7253;"><strong>— Ticket Nen BD</strong></p>
  </div>
  `;
}

module.exports = { ticketEmailHtml };

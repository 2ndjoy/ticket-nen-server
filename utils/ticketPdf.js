// utils/ticketPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const dayjs = require("dayjs");

/** ASCII-safe money formatter (works with default Helvetica) */
function moneyBDT(n) {
  const num = Number(n || 0);
  // ASCII digits + thousands separators; avoid Bengali digits / special symbol
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
  return `BDT ${formatted}`;
}

/** Write a muted label and bold value block */
function labelValue(doc, { label, value, x, y, w, labelColor = "#6B7280", valueColor = "#111827" }) {
  const labelFontSize = 9;
  const valueFontSize = 11;
  const gap = 4;

  doc.font("Helvetica").fontSize(labelFontSize).fillColor(labelColor)
    .text(label.toUpperCase(), x, y, { width: w });

  const labelH = doc.currentLineHeight();
  doc.font("Helvetica-Bold").fontSize(valueFontSize).fillColor(valueColor)
    .text(String(value ?? "-"), x, y + labelH + gap, { width: w });

  return labelH + gap + doc.currentLineHeight() + 8;
}

async function buildTicketPdf({ event, booking, qrPayload }) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const BRAND = "#0b7253";
  const ACCENT = "#ef8bb7";
  const BG_GRAD_TOP = "#F1FFF8";
  const CARD_BG = "#FFFFFF";
  const TEXT = "#0F172A";
  const MUTED = "#64748B";
  const HAIRLINE = "#E2E8F0";

  // Header bar + background
  doc.rect(0, 0, doc.page.width, 80).fill(BRAND);
  doc.rect(0, 80, doc.page.width, doc.page.height - 80).fill(BG_GRAD_TOP);

  // Header text
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(26)
    .text("YOUR EVENT TICKET", 36, 28, { align: "left" });
  doc.font("Helvetica").fontSize(10).fillColor("#DAF5E7")
    .text("Please keep a copy on your phone", 36, 56);

  // Card
  const cardX = 36, cardY = 112, cardW = doc.page.width - 72, cardH = 440, r = 16;
  doc.save()
    .roundedRect(cardX + 3, cardY + 3, cardW, cardH, r)
    .fillOpacity(0.06).fill("#000000")
    .restore();
  doc.roundedRect(cardX, cardY, cardW, cardH, r).fill(CARD_BG);

  // Pill
  const pill = "EVENT TICKET";
  const pillPadX = 12, pillPadY = 6;
  const pillW = doc.widthOfString(pill, { font: "Helvetica-Bold", size: 10 }) + pillPadX * 2;
  doc.save()
    .roundedRect(cardX + 24, cardY - 14, pillW, 28, 99)
    .fill(ACCENT)
    .fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10)
    .text(pill, cardX + 24 + pillPadX, cardY - 14 + pillPadY)
    .restore();

  // Content area
  const pad = 28;
  const cx = cardX + pad;
  let cy = cardY + pad;
  const innerW = cardW - pad * 2;

  // Title & subtitle
  doc.font("Helvetica-Bold").fontSize(20).fillColor(TEXT)
    .text(event?.title || "Event", cx, cy, { width: innerW });
  cy += doc.currentLineHeight() + 6;

  if (event?.subtitle) {
    doc.font("Helvetica").fontSize(11).fillColor(MUTED)
      .text(event.subtitle, cx, cy, { width: innerW });
    cy += doc.currentLineHeight() + 10;
  }

  // Divider
  doc.moveTo(cx, cy).lineTo(cx + innerW, cy).lineWidth(1).strokeColor(HAIRLINE).stroke();
  cy += 16;

  const dateStr = dayjs(event?.date).isValid()
    ? dayjs(event.date).format("dddd, MMMM D, YYYY")
    : String(event?.date || "");
  const timeStr = event?.time || "TBA";
  const venueStr = event?.location || event?.venue || "TBA";
  const typeStr = String(booking?.ticketType || "-").toUpperCase();

  const gutter = 28;
  const leftW = Math.floor((innerW - gutter) * 0.6);
  const rightW = innerW - gutter - leftW;

  // Left column
  let rowH = [];
  rowH.push(labelValue(doc, { label: "Date", value: dateStr, x: cx, y: cy, w: Math.floor(leftW * 0.55) }));
  rowH.push(labelValue(doc, { label: "Time", value: timeStr, x: cx + Math.floor(leftW * 0.6), y: cy, w: Math.floor(leftW * 0.4) }));
  cy += Math.max(...rowH);

  cy += 2;
  cy += labelValue(doc, { label: "Venue", value: venueStr, x: cx, y: cy, w: leftW });

  rowH = [];
  rowH.push(labelValue(doc, { label: "Attendee", value: booking?.name || "-", x: cx, y: cy, w: Math.floor(leftW * 0.5) - 6 }));
  rowH.push(labelValue(doc, { label: "Phone", value: booking?.phoneNumber || "-", x: cx + Math.floor(leftW * 0.5) + 6, y: cy, w: Math.floor(leftW * 0.5) - 6 }));
  cy += Math.max(...rowH);

  cy += labelValue(doc, { label: "Email", value: booking?.email || "-", x: cx, y: cy, w: leftW });

  rowH = [];
  rowH.push(labelValue(doc, { label: "Ticket Type", value: typeStr, x: cx, y: cy, w: Math.floor(leftW / 3) - 8 }));
  rowH.push(labelValue(doc, { label: "Quantity", value: booking?.quantity || 1, x: cx + Math.floor(leftW / 3) + 8, y: cy, w: Math.floor(leftW / 3) - 8 }));
  // ↓↓↓ use ASCII-safe money here
  rowH.push(labelValue(doc, { label: "Amount Paid", value: moneyBDT(booking?.amount), x: cx + 2 * Math.floor(leftW / 3) + 16, y: cy, w: Math.floor(leftW / 3) - 16 }));
  cy += Math.max(...rowH);

  cy += labelValue(doc, { label: "Booking ID", value: booking?._id, x: cx, y: cy, w: leftW });

  // Right column: QR
  const qrX = cx + leftW + gutter;
  const qrY = cardY + pad;
  const qrPanelH = 200;
  doc.roundedRect(qrX, qrY, rightW, qrPanelH, 12).fill("#F8FAFC");

  const qrValue = JSON.stringify(qrPayload || {});
  const qr = await QRCode.toBuffer(qrValue, { type: "png", errorCorrectionLevel: "H", margin: 1, scale: 8 });
  const qrSize = 140;
  const imgX = qrX + (rightW - qrSize) / 2;
  const imgY = qrY + 14;
  doc.image(qr, imgX, imgY, { fit: [qrSize, qrSize] });

  doc.font("Helvetica").fontSize(10).fillColor(MUTED)
    .text("Scan to verify", qrX, imgY + qrSize + 10, { width: rightW, align: "center" });

  // Footer
  const bottomY = cardY + cardH - 78;
  doc.moveTo(cx, bottomY).lineTo(cx + innerW, bottomY).lineWidth(1).strokeColor(HAIRLINE).stroke();

  doc.font("Helvetica").fontSize(9).fillColor(MUTED)
    .text("Present this ticket at the venue entrance. Keep a digital copy as backup.", cx, bottomY + 12, {
      width: innerW,
      align: "center",
    });

  doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND)
    .text(`Generated ${dayjs().format("MMM D, YYYY h:mm A")}`, cx, bottomY + 30, {
      width: innerW,
      align: "right",
    });

  doc.end();
  return done;
}

module.exports = { buildTicketPdf, moneyBDT };

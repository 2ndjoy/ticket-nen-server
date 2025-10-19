// utils/ticketPdf.js
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const dayjs = require("dayjs");

/** ASCII-safe money formatter (Helvetica-safe) */
function moneyBDT(n) {
  const num = Number(n || 0);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
  return `BDT ${formatted}`;
}

/** Write a muted label and bold value block (matches web Info component) */
function labelValue(
  doc,
  {
    label,
    value,
    x,
    y,
    w,
    labelColor = "#6B7280",
    valueColor = "#111827",
    mono = false,
    accent = false,
  }
) {
  const labelFontSize = 9;
  const valueFontSize = 11;
  const gap = 4;

  doc.save();
  doc.font("Helvetica").fontSize(labelFontSize).fillColor(labelColor).text(
    String(label || "").toUpperCase(),
    x,
    y,
    { width: w }
  );

  const labelH = doc.currentLineHeight();
  doc
    .font(mono ? "Helvetica" : "Helvetica-Bold")
    .fontSize(valueFontSize)
    .fillColor(accent ? "#0b7253" : valueColor)
    .text(String(value ?? "-"), x, y + labelH + gap, { width: w });
  const valH = doc.currentLineHeight();
  doc.restore();

  return labelH + gap + valH + 8;
}

async function buildTicketPdf({ event, booking, qrPayload }) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  // Shared palette (matches web)
  const BRAND = "#0b7253"; // green
  const ACCENT = "#ef8bb7"; // pink
  const CARD_BG = "#FFFFFF";
  const TEXT = "#0F172A";
  const MUTED = "#64748B";
  const HAIRLINE = "#E2E8F0";
  const PANEL_BG = "#F8FAFC";

  // Header gradient bar (brand -> accent)
  const headerH = 110;
  const grad = doc.linearGradient(0, 0, doc.page.width, headerH);
  grad.stop(0, BRAND).stop(1, ACCENT);
  doc.rect(0, 0, doc.page.width, headerH).fill(grad);

  // Header text
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(24).text("EVENT TICKET", 36, 28);
  doc.font("Helvetica").fontSize(10).fillColor("#F1FAF5").text("Please keep a digital copy as backup", 36, 60);

  // Card with subtle shadow
  const cardX = 36,
    cardY = headerH - 18,
    cardW = doc.page.width - 72,
    cardH = 480,
    r = 16;
  doc
    .save()
    .roundedRect(cardX + 3, cardY + 3, cardW, cardH, r)
    .fillOpacity(0.06)
    .fill("#000000")
    .restore();

  // Card background (solid white to match web inner card)
  doc.roundedRect(cardX, cardY, cardW, cardH, r).fill(CARD_BG);

  // Decorative soft blobs
  doc
    .save()
    .fillColor("#000000")
    .fillOpacity(0.08)
    .circle(cardX + cardW - 60, cardY + 20, 34)
    .fill()
    .circle(cardX + 40, cardY + cardH - 40, 46)
    .fill()
    .restore();

  // Pill
  const pill = "EVENT TICKET";
  const pillPadX = 12,
    pillPadY = 6;
  doc.font("Helvetica-Bold").fontSize(10);
  const pillW = doc.widthOfString(pill) + pillPadX * 2;
  doc
    .save()
    .roundedRect(cardX + 24, cardY - 16, pillW, 28, 99)
    .fill(ACCENT)
    .fillColor("#FFFFFF")
    .text(pill, cardX + 24 + pillPadX, cardY - 16 + pillPadY)
    .restore();

  // Inner padding & columns
  const pad = 28;
  const cx = cardX + pad;
  let cy = cardY + pad;
  const innerW = cardW - pad * 2;

  // Title & subtitle
  doc.font("Helvetica-Bold").fontSize(20).fillColor(TEXT).text(event?.title || "Event", cx, cy, {
    width: innerW,
    align: "center",
  });
  cy += doc.currentLineHeight() + 6;

  if (event?.subtitle) {
    doc.font("Helvetica").fontSize(11).fillColor(MUTED).text(event.subtitle, cx, cy, {
      width: innerW,
      align: "center",
    });
    cy += doc.currentLineHeight() + 10;
  }

  // Divider
  doc.moveTo(cx, cy).lineTo(cx + innerW, cy).lineWidth(1).strokeColor(HAIRLINE).stroke();
  cy += 16;

  // Normalized strings
  const dateStr = dayjs(event?.date).isValid()
    ? dayjs(event.date).format("dddd, MMMM D, YYYY")
    : String(event?.date || "");
  const timeStr = event?.time || "TBA";
  const venueStr = event?.location || event?.venue || "TBA";
  const typeStr = String(booking?.ticketType || "-").toUpperCase();

  const gutter = 28;
  const leftW = Math.floor((innerW - gutter) * 0.6);
  const rightW = innerW - gutter - leftW;

  // LEFT column
  let rowH = [];
  rowH.push(
    labelValue(doc, { label: "Date", value: dateStr, x: cx, y: cy, w: Math.floor(leftW * 0.55) })
  );
  rowH.push(
    labelValue(doc, {
      label: "Time",
      value: timeStr,
      x: cx + Math.floor(leftW * 0.6),
      y: cy,
      w: Math.floor(leftW * 0.4),
    })
  );
  cy += Math.max(...rowH);

  cy += 2;
  cy += labelValue(doc, { label: "Venue", value: venueStr, x: cx, y: cy, w: leftW });

  rowH = [];
  rowH.push(
    labelValue(doc, {
      label: "Attendee",
      value: booking?.name || "-",
      x: cx,
      y: cy,
      w: Math.floor(leftW * 0.5) - 6,
    })
  );
  rowH.push(
    labelValue(doc, {
      label: "Phone",
      value: booking?.phoneNumber || "-",
      x: cx + Math.floor(leftW * 0.5) + 6,
      y: cy,
      w: Math.floor(leftW * 0.5) - 6,
    })
  );
  cy += Math.max(...rowH);

  cy += labelValue(doc, { label: "Email", value: booking?.email || "-", x: cx, y: cy, w: leftW });

  rowH = [];
  rowH.push(
    labelValue(doc, {
      label: "Ticket Type",
      value: typeStr,
      x: cx,
      y: cy,
      w: Math.floor(leftW / 3) - 8,
    })
  );
  rowH.push(
    labelValue(doc, {
      label: "Quantity",
      value: booking?.quantity || 1,
      x: cx + Math.floor(leftW / 3) + 8,
      y: cy,
      w: Math.floor(leftW / 3) - 8,
    })
  );
  rowH.push(
    labelValue(doc, {
      label: "Amount Paid",
      value: moneyBDT(booking?.amount),
      x: cx + 2 * Math.floor(leftW / 3) + 16,
      y: cy,
      w: Math.floor(leftW / 3) - 16,
    })
  );
  cy += Math.max(...rowH);

  cy += labelValue(doc, { label: "Booking ID", value: booking?._id, x: cx, y: cy, w: leftW, mono: true });
  cy += labelValue(doc, {
    label: "Ticket ID",
    value: qrPayload?.ticketId || "-",
    x: cx,
    y: cy,
    w: leftW,
    mono: true,
    accent: true,
  });

  // RIGHT column: QR panel
  const qrX = cx + leftW + gutter;
  const qrY = cardY + pad;
  const qrPanelH = 220;
  doc.roundedRect(qrX, qrY, rightW, qrPanelH, 12).fill(PANEL_BG).strokeColor(HAIRLINE).lineWidth(1).stroke();

  const qrValue = JSON.stringify(qrPayload || {});
  const qr = await QRCode.toBuffer(qrValue, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 1,
    scale: 8,
  });
  const qrSize = 150;
  const imgX = qrX + (rightW - qrSize) / 2;
  const imgY = qrY + 18;
  doc.image(qr, imgX, imgY, { fit: [qrSize, qrSize] });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text("Scan to verify", qrX, imgY + qrSize + 10, { width: rightW, align: "center" });

  // Footer
  const bottomY = cardY + cardH - 78;
  doc.moveTo(cx, bottomY).lineTo(cx + innerW, bottomY).lineWidth(1).strokeColor(HAIRLINE).stroke();

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text("Present this ticket at the venue entrance. Keep a digital copy as backup.", cx, bottomY + 12, {
      width: innerW,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(BRAND)
    .text(`Generated ${dayjs().format("MMM D, YYYY h:mm A")}`, cx, bottomY + 30, {
      width: innerW,
      align: "right",
    });

  doc.end();
  return done;
}

module.exports = { buildTicketPdf, moneyBDT };

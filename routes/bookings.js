// routes/bookings.js
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Event = require("../models/Event");

// NEW: mail + PDF utils
const { sendMail } = require("../utils/mailer");
const { buildTicketPdf } = require("../utils/ticketPdf");
const { ticketEmailHtml } = require("../utils/emailTemplates");

// 🔐 Verify Firebase Token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.firebaseUid = decoded.uid;
    req.firebaseEmail = decoded.email || null;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Helper: atomic decrement of inventory (MUST use real schema paths)
async function decrementInventory(eventId, ticketType, qty, session) {
  const field = ticketType === "vip" ? "vipTicketQuantity" : "ticketQuantity";

  const filter = { _id: eventId, [field]: { $gte: qty } };

  const updated = await Event.findOneAndUpdate(
    filter,
    { $inc: { [field]: -qty } },
    { new: true, session, runValidators: true }
  );

  // returns null if insufficient
  return updated;
}

// Shape the event so the client sees both canonical + alias-style fields
function shapeEventForClient(evDoc) {
  if (!evDoc) return evDoc;
  const obj = evDoc.toObject({ virtuals: true, getters: true, versionKey: false });
  obj.vipTickets = obj.vipTicketQuantity;
  obj.regularTickets = obj.ticketQuantity;
  obj.vipPrice = obj.vipTicketPrice;
  obj.regularPrice = obj.regularTicketPrice;
  return obj;
}

// 📌 Create booking (transaction + unique index guard)
router.post("/", verifyFirebaseToken, async (req, res) => {
  const { eventId, name, email, phoneNumber, ticketType, quantity } = req.body;
  const userId = req.firebaseUid;

  if (!eventId || !ticketType || !quantity) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ error: "Invalid event id" });
  }

  const qty = Math.max(1, Number(quantity) || 1);
  const tType = ticketType === "vip" ? "vip" : "regular";

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const already = await Booking.findOne({ eventId, userId });
    if (already) {
      return res.status(409).json({ error: "You already booked this event" });
    }

    const unitPrice =
      tType === "vip"
        ? Number(event.vipTicketPrice || 0)
        : Number(event.regularTicketPrice || 0);
    const totalAmount = unitPrice * qty;

    const session = await mongoose.startSession();
    let updatedEvent = null;
    let booking = null;

    try {
      await session.withTransaction(async () => {
        // 1) Decrement stock atomically
        updatedEvent = await decrementInventory(eventId, tType, qty, session);
        if (!updatedEvent) throw new Error("Not enough tickets available");

        // 2) Create booking
        const [created] = await Booking.create(
          [
            {
              eventId,
              userId,
              name,
              email,
              phoneNumber,
              ticketType: tType,
              quantity: qty,
              unitPrice,
              amount: totalAmount,
            },
          ],
          { session }
        );
        booking = created;
      });
    } catch (txErr) {
      if (txErr && txErr.message === "Not enough tickets available") {
        return res.status(400).json({ error: "Sold out or insufficient tickets" });
      }

      // Fallback (no transactions)
      try {
        const dup = await Booking.findOne({ eventId, userId });
        if (dup) return res.status(409).json({ error: "You already booked this event" });

        updatedEvent = await decrementInventory(eventId, tType, qty, null);
        if (!updatedEvent) {
          return res.status(400).json({ error: "Sold out or insufficient tickets" });
        }

        try {
          booking = await Booking.create({
            eventId,
            userId,
            name,
            email,
            phoneNumber,
            ticketType: tType,
            quantity: qty,
            unitPrice,
            amount: totalAmount,
          });
        } catch (e) {
          if (e && e.code === 11000) {
            return res.status(409).json({ error: "You already booked this event" });
          }
          throw e;
        }
      } catch (fallbackErr) {
        console.error("Booking fallback error:", fallbackErr);
        return res.status(500).json({ error: "Server error" });
      }
    } finally {
      await session.endSession();
    }

    // Respond to client first
    res.status(201).json({
      message: "Booking successful",
      booking,
      event: shapeEventForClient(updatedEvent),
    });

    // Fire-and-forget: send ticket email with PDF
    setImmediate(async () => {
      try {
        const fresh = await Booking.findById(booking._id).populate("eventId");
        if (!fresh) return;
        const ev = fresh.eventId;

        const qrPayload = {
          ticketId: `TKT-${String(fresh._id).slice(-8).toUpperCase()}`,
          bookingId: fresh._id,
          eventId: ev._id,
          eventTitle: ev.title,
          name: fresh.name,
          email: fresh.email,
          phoneNumber: fresh.phoneNumber,
          amount: fresh.amount,
          ticketType: fresh.ticketType,
          quantity: fresh.quantity,
          date: ev.date,
          time: ev.time,
          venue: ev.location,
          generatedAt: new Date().toISOString(),
        };

        const pdfBuffer = await buildTicketPdf({ event: ev, booking: fresh, qrPayload });
        const html = ticketEmailHtml({ event: ev, booking: fresh });

        await sendMail({
          to: fresh.email,
          subject: `Your Ticket: ${ev.title}`,
          html,
          attachments: [
            {
              filename: `ticket-${fresh._id}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        });
      } catch (mailErr) {
        console.error("Ticket email error:", mailErr);
      }
    });
  } catch (err) {
    console.error("Booking error:", err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: "You already booked this event" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

// 📌 Get bookings for logged-in user
router.get("/my-bookings", verifyFirebaseToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.firebaseUid })
      .populate("eventId")
      .lean();

    const shaped = bookings.map((b) => {
      if (b.eventId) {
        const ev = b.eventId;
        ev.vipTickets = ev.vipTicketQuantity;
        ev.regularTickets = ev.ticketQuantity;
        ev.vipPrice = ev.vipTicketPrice;
        ev.regularPrice = ev.regularTicketPrice;
      }
      return b;
    });
    return res.json(shaped);
  } catch (err) {
    console.error("Fetch bookings error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
});

// NEW: Resend ticket email
router.post("/:id/resend", verifyFirebaseToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("eventId");
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.userId !== req.firebaseUid) {
      return res.status(403).json({ error: "Not allowed" });
    }

    const event = booking.eventId;
    const qrPayload = {
      ticketId: `TKT-${String(booking._id).slice(-8).toUpperCase()}`,
      bookingId: booking._id,
      eventId: event._id,
      eventTitle: event.title,
      name: booking.name,
      email: booking.email,
      phoneNumber: booking.phoneNumber,
      amount: booking.amount,
      ticketType: booking.ticketType,
      quantity: booking.quantity,
      date: event.date,
      time: event.time,
      venue: event.location,
      generatedAt: new Date().toISOString(),
    };

    const pdfBuffer = await buildTicketPdf({ event, booking, qrPayload });
    const html = ticketEmailHtml({ event, booking });

    await sendMail({
      to: booking.email,
      subject: `Your Ticket: ${event.title} (Resent)`,
      html,
      attachments: [{ filename: `ticket-${booking._id}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    });

    return res.json({ ok: true, message: "Ticket email resent." });
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(500).json({ error: "Failed to resend ticket" });
  }
});

module.exports = router;

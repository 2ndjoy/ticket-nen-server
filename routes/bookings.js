// routes/bookings.js
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Event = require("../models/Event");

// 🔐 Verify Firebase Token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.firebaseUid = decoded.uid;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Helper: atomic decrement of inventory
async function decrementInventory(eventId, ticketType, qty, session) {
  const field = ticketType === "vip" ? "vipTickets" : "regularTickets";
  const inc = {};
  inc[field] = -qty;
  inc["attendees"] = qty;

  const filter = { _id: eventId, [field]: { $gte: qty } };

  const updated = await Event.findOneAndUpdate(
    filter,
    { $inc: inc },
    { new: true, session }
  );

  return updated; // null if insufficient
}

// 📌 Create booking (transaction + unique index guard)
router.post("/", verifyFirebaseToken, async (req, res) => {
  const { eventId, name, email, phoneNumber, ticketType, quantity } = req.body;
  const userId = req.firebaseUid;
  const qty = Math.max(1, Number(quantity) || 1);
  const tType = ticketType === "vip" ? "vip" : "regular";

  try {
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Friendly precheck to avoid hitting unique index most of the time
    const already = await Booking.findOne({ eventId, userId });
    if (already) {
      return res.status(409).json({ error: "You already booked this event" });
    }

    const unitPrice = tType === "vip" ? Number(event.vipPrice || 0) : Number(event.regularPrice || 0);
    const totalAmount = unitPrice * qty;

    const session = await mongoose.startSession();
    let updatedEvent = null;
    let booking = null;

    try {
      await session.withTransaction(async () => {
        // 1) Decrement stock
        updatedEvent = await decrementInventory(eventId, tType, qty, session);
        if (!updatedEvent) throw new Error("Not enough tickets available");

        // 2) Create booking (unique index protects against race dupes)
        booking = await Booking.create([{
          eventId,
          userId,
          name,
          email,
          phoneNumber,
          ticketType: tType,
          quantity: qty,
          unitPrice,
          amount: totalAmount,
        }], { session });
      });

      booking = booking?.[0] || booking;
    } catch (txErr) {
      // Transaction failed -> inspect why
      if (txErr && txErr.message === "Not enough tickets available") {
        await session.endSession();
        return res.status(400).json({ error: "Sold out or insufficient tickets" });
      }
      // Could be no transactions support or unique index conflict
      try {
        // Fallback path (no transactions)
        // Ensure not duplicate
        const dup = await Booking.findOne({ eventId, userId });
        if (dup) {
          await session.endSession();
          return res.status(409).json({ error: "You already booked this event" });
        }

        // Atomic stock decrement
        updatedEvent = await decrementInventory(eventId, tType, qty, null);
        if (!updatedEvent) {
          await session.endSession();
          return res.status(400).json({ error: "Sold out or insufficient tickets" });
        }

        // Create booking; catch unique index race
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
          // Unique index violation
          if (e && e.code === 11000) {
            return res.status(409).json({ error: "You already booked this event" });
          }
          throw e;
        }
      } catch (fallbackErr) {
        console.error("Booking fallback error:", fallbackErr);
        await session.endSession();
        return res.status(500).json({ error: "Server error" });
      }
    } finally {
      await session.endSession();
    }

    return res.status(201).json({
      message: "Booking successful",
      booking,
      event: updatedEvent,
    });
  } catch (err) {
    console.error("Booking error:", err);
    // Surface duplicate booking nicely
    if (err && err.code === 11000) {
      return res.status(409).json({ error: "You already booked this event" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

// 📌 Get bookings for logged-in user
router.get("/my-bookings", verifyFirebaseToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.firebaseUid }).populate("eventId");
    return res.json(bookings);
  } catch (err) {
    console.error("Fetch bookings error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

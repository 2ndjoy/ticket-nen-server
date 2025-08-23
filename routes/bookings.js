const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");

const Booking = require("../models/Booking");
const Event = require("../models/Event");

// ===============================
// 🔐 Middleware: Verify Firebase Token
// ===============================
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.firebaseUid = decoded.uid; // Store user ID in request
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ===============================
// 📌 Create a new booking
// ===============================
router.post("/", verifyFirebaseToken, async (req, res) => {
  const { eventId, name, email, phoneNumber, amount } = req.body;
  const userId = req.firebaseUid;

  try {
    // ✅ Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // ✅ Prevent duplicate booking (optional)
    const existingBooking = await Booking.findOne({ eventId, userId });
    if (existingBooking) {
      return res.status(400).json({ error: "You already booked this event" });
    }

    // ✅ Create new booking
    const booking = new Booking({
      eventId,
      userId,
      name,
      email,
      phoneNumber,
      amount,
    });

    await booking.save();

    // ✅ Update event attendees count
    event.attendees = (event.attendees || 0) + 1;
    await event.save();

    return res.status(201).json({
      message: "Booking successful",
      booking,
    });
  } catch (err) {
    console.error("Booking error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// 📌 Get bookings for logged-in user
// ===============================
router.get("/my-bookings", verifyFirebaseToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.firebaseUid })
      .populate("eventId"); // Populates event details

    return res.json(bookings);
  } catch (err) {
    console.error("Fetch bookings error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

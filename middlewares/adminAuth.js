// routes/adminSimple.js
const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Organizer = require("../models/Organizer");
const Event = require("../models/Event");
const Booking = require("../models/Booking");

// tiny helper
function getPaging(req) {
  const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

// GET /api/admin/metrics
router.get("/metrics", async (_req, res) => {
  try {
    const [totalUsers, totalOrganizers, totalEvents, totalBookings] = await Promise.all([
      User.countDocuments(),
      Organizer.countDocuments(),
      Event.countDocuments(),
      Booking.countDocuments(),
    ]);
    res.json({ totalUsers, totalOrganizers, totalEvents, totalBookings });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const { limit, skip } = getPaging(req);
    const [total, items] = await Promise.all([
      User.countDocuments(),
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    res.json({ total, items });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// GET /api/admin/organizers
router.get("/organizers", async (req, res) => {
  try {
    const { limit, skip } = getPaging(req);
    const [total, items] = await Promise.all([
      Organizer.countDocuments(),
      Organizer.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    res.json({ total, items });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// GET /api/admin/events
router.get("/events", async (req, res) => {
  try {
    const { limit, skip } = getPaging(req);
    const [total, items] = await Promise.all([
      Event.countDocuments(),
      Event.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    res.json({ total, items });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// GET /api/admin/bookings
router.get("/bookings", async (req, res) => {
  try {
    const { limit, skip } = getPaging(req);
    const [total, items] = await Promise.all([
      Booking.countDocuments(),
      Booking.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    res.json({ total, items });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

module.exports = router;

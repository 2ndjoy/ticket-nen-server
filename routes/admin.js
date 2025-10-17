// routes/adminSimple.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose"); // <-- for isValidObjectId

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

/* =========================
   METRICS
========================= */
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
    console.error("admin metrics error:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

/* =========================
   USERS
========================= */
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
    console.error("admin users list error:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).end();
  } catch (e) {
    console.error("admin delete user error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   ORGANIZERS
========================= */
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
    console.error("admin organizers list error:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// DELETE /api/admin/organizers/:id
router.delete("/organizers/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid organizer id" });
  }
  try {
    const deleted = await Organizer.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).end();
  } catch (e) {
    console.error("admin delete organizer error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   EVENTS
========================= */
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
    console.error("admin events list error:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// DELETE /api/admin/events/:id
router.delete("/events/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid event id" });
  }
  try {
    const deleted = await Event.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).end();
  } catch (e) {
    console.error("admin delete event error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   BOOKINGS
========================= */
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
    console.error("admin bookings list error:", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// DELETE /api/admin/bookings/:id
router.delete("/bookings/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid booking id" });
  }
  try {
    const deleted = await Booking.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).end();
  } catch (e) {
    console.error("admin delete booking error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

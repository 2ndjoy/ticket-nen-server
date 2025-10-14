// routes/adminMetrics.js
const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const Event = require("../models/Event");
const Booking = require("../models/Booking");

/** ─────────────────────────────────────────────────────────────────────────────
 * (Optional) Secure these routes for admins only.
 *   1) Uncomment verifyFirebaseToken + requireAdmin
 *   2) Mount with: app.use("/api/admin/metrics", verifyFirebaseToken, requireAdmin, router);
 *   3) Set env ADMIN_EMAILS="admin1@example.com,admin2@example.com"
 * ──────────────────────────────────────────────────────────────────────────── */
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.firebase = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireAdmin = (req, res, next) => {
  const email = String(req.firebase?.email || "").toLowerCase();
  const admins = String(process.env.ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (admins.includes(email)) return next();
  return res.status(403).json({ error: "Admin access required" });
};

// Helper: start + end bounds for the last N months (inclusive of current month)
function lastNMonths(n = 6) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1); // first of NEXT month
  const start = new Date(now.getFullYear(), now.getMonth() + 1 - n, 1); // first of month N months ago
  return { start, end };
}

// ───────────────────────── Overview ─────────────────────────
// GET /api/admin/metrics/overview
router.get("/overview", async (_req, res) => {
  try {
    const [totalEvents, soldAgg, distinctUsers] = await Promise.all([
      Event.countDocuments({}),
      Booking.aggregate([{ $group: { _id: null, sold: { $sum: "$quantity" } } }]),
      Booking.distinct("userId"),
    ]);
    res.json({
      totalEvents,
      ticketsSold: soldAgg?.[0]?.sold || 0,
      totalUsers: Array.isArray(distinctUsers) ? distinctUsers.length : 0,
    });
  } catch (e) {
    console.error("overview error:", e);
    res.status(500).json({ error: "Failed to compute overview" });
  }
});

// ────────────── Events by Month (last 6 months) ─────────────
// GET /api/admin/metrics/events-by-month
router.get("/events-by-month", async (_req, res) => {
  try {
    const { start, end } = lastNMonths(6);
    const rows = await Event.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, events: { $count: {} } } },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
    ]);

    // Fill missing months with 0
    const out = [];
    const cur = new Date(start);
    while (cur < end) {
      const y = cur.getFullYear();
      const m = cur.getMonth() + 1;
      const label = cur.toLocaleString(undefined, { month: "short" });
      const found = rows.find(r => r._id.y === y && r._id.m === m);
      out.push({ name: label, events: found ? found.events : 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
    res.json(out);
  } catch (e) {
    console.error("events-by-month error:", e);
    res.status(500).json({ error: "Failed to compute events by month" });
  }
});

// ──────────────── Categories breakdown ────────────────
// GET /api/admin/metrics/categories
router.get("/categories", async (_req, res) => {
  try {
    const rows = await Event.aggregate([
      { $group: { _id: { $ifNull: ["$category", "Uncategorized"] }, value: { $count: {} } } },
      { $sort: { value: -1 } },
    ]);
    res.json(rows.map(r => ({ name: r._id, value: r.value })));
  } catch (e) {
    console.error("categories error:", e);
    res.status(500).json({ error: "Failed to compute categories" });
  }
});

// ────────────── Top events by tickets sold ──────────────
// GET /api/admin/metrics/top-events?limit=8
router.get("/top-events", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(30, Number(req.query.limit) || 8));
    const rows = await Booking.aggregate([
      { $group: { _id: "$eventId", sold: { $sum: "$quantity" } } },
      { $sort: { sold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $project: { eventId: "$_id", sold: 1, title: { $ifNull: ["$event.title", "(deleted event)"] } } },
    ]);
    res.json(rows);
  } catch (e) {
    console.error("top-events error:", e);
    res.status(500).json({ error: "Failed to compute top events" });
  }
});

module.exports = router;

// To secure: module.exports = { router, verifyFirebaseToken, requireAdmin };

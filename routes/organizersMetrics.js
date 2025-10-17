// routes/organizersMetrics.js
const express = require("express");
const admin = require("firebase-admin");
const mongoose = require("mongoose");
const router = express.Router();

const Event = require("../models/Event");
const Booking = require("../models/Booking");

// 🔐 Verify Firebase token
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

const ownerFilter = (email) => ({ $or: [{ loggedinemail: email }, { email }] });

/**
 * GET /api/organizers/metrics
 * Optional query:
 *   from=YYYY-MM-DD
 *   to=YYYY-MM-DD
 *   q=search text (title/category/location match)
 */
router.get("/metrics", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    const { from, to, q } = req.query;

    // 1) Load organizer-owned events
    const eventQuery = { ...ownerFilter(email) };
    if (q) {
      eventQuery.$or = [
        { title: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
      // Also keep ownership filter
      eventQuery.$and = [ownerFilter(email)];
    }

    const events = await Event.find(eventQuery).lean();
    const eventIds = events.map((e) => e._id);

    if (eventIds.length === 0) {
      return res.json({
        totals: { ticketsSold: 0, capacity: 0, remaining: 0, revenue: 0, orders: 0, sellThrough: 0 },
        events: [],
      });
    }

    // 2) Build booking match (by owned events + optional date range)
    const bookingMatch = { eventId: { $in: eventIds } };
    if (from || to) {
      bookingMatch.createdAt = {};
      if (from) bookingMatch.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        // make 'to' inclusive by adding 1 day and using $lt
        bookingMatch.createdAt.$lt = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1);
      }
    }

    // 3) Aggregate bookings per event + type
    const salesAgg = await Booking.aggregate([
      { $match: bookingMatch },
      {
        $group: {
          _id: { eventId: "$eventId", ticketType: "$ticketType" },
          qty: { $sum: "$quantity" },
          revenue: { $sum: "$amount" },
          orders: { $sum: 1 },
        },
      },
    ]);

    // Build a map: eventId -> { vip: {qty,revenue,orders}, regular: {...}, totals }
    const byEvent = new Map();
    for (const row of salesAgg) {
      const evId = String(row._id.eventId);
      const tType = row._id.ticketType; // 'vip' or 'regular'
      if (!byEvent.has(evId)) {
        byEvent.set(evId, {
          vip: { qty: 0, revenue: 0, orders: 0 },
          regular: { qty: 0, revenue: 0, orders: 0 },
        });
      }
      const slot = byEvent.get(evId)[tType] || { qty: 0, revenue: 0, orders: 0 };
      slot.qty += row.qty || 0;
      slot.revenue += row.revenue || 0;
      slot.orders += row.orders || 0;
      byEvent.get(evId)[tType] = slot;
    }

    // 4) Merge with events to compute capacities & remaining
    const resultEvents = [];
    let globalTicketsSold = 0;
    let globalCapacity = 0;
    let globalRevenue = 0;
    let globalOrders = 0;

    for (const ev of events) {
      const evIdStr = String(ev._id);
      const sold = byEvent.get(evIdStr) || {
        vip: { qty: 0, revenue: 0, orders: 0 },
        regular: { qty: 0, revenue: 0, orders: 0 },
      };

      const vipCapacity = Number(ev.vipTicketQuantity || 0);
      const regCapacity = Number(ev.ticketQuantity || 0);
      const vipSold = Number(sold.vip.qty || 0);
      const regSold = Number(sold.regular.qty || 0);

      const vipRemaining = Math.max(0, vipCapacity - vipSold);
      const regRemaining = Math.max(0, regCapacity - regSold);

      const capacity = vipCapacity + regCapacity;
      const ticketsSold = vipSold + regSold;
      const remaining = vipRemaining + regRemaining;
      const revenue = Number(sold.vip.revenue || 0) + Number(sold.regular.revenue || 0);
      const orders = Number(sold.vip.orders || 0) + Number(sold.regular.orders || 0);
      const sellThrough = capacity > 0 ? +(ticketsSold / capacity * 100).toFixed(2) : 0;

      resultEvents.push({
        eventId: ev._id,
        title: ev.title,
        date: ev.date,
        time: ev.time,
        location: ev.location,
        category: ev.category,
        status: ev.status,
        vip: {
          price: ev.vipTicketPrice ?? 0,
          capacity: vipCapacity,
          sold: vipSold,
          remaining: vipRemaining,
          revenue: Number(sold.vip.revenue || 0),
          orders: Number(sold.vip.orders || 0),
        },
        regular: {
          price: ev.regularTicketPrice ?? 0,
          capacity: regCapacity,
          sold: regSold,
          remaining: regRemaining,
          revenue: Number(sold.regular.revenue || 0),
          orders: Number(sold.regular.orders || 0),
        },
        totals: {
          capacity,
          sold: ticketsSold,
          remaining,
          revenue,
          orders,
          sellThrough, // %
        },
      });

      globalTicketsSold += ticketsSold;
      globalCapacity += capacity;
      globalRevenue += revenue;
      globalOrders += orders;
    }

    const globalSellThrough = globalCapacity > 0 ? +(globalTicketsSold / globalCapacity * 100).toFixed(2) : 0;

    // Sort by createdAt desc to keep it sensible (or by date)
    resultEvents.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

    res.json({
      totals: {
        ticketsSold: globalTicketsSold,
        capacity: globalCapacity,
        remaining: Math.max(0, globalCapacity - globalTicketsSold),
        revenue: globalRevenue,
        orders: globalOrders,
        sellThrough: globalSellThrough,
      },
      events: resultEvents,
    });
  } catch (err) {
    console.error("metrics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/organizers/events/:id/metrics
 * Per-event breakdown only (same shape as single item above)
 */
router.get("/events/:id/metrics", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    const { id } = req.params;

    const ev = await Event.findOne({ _id: id, ...ownerFilter(email) }).lean();
    if (!ev) return res.status(404).json({ error: "Event not found or not owned by you" });

    const rows = await Booking.aggregate([
      { $match: { eventId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$ticketType",
          qty: { $sum: "$quantity" },
          revenue: { $sum: "$amount" },
          orders: { $sum: 1 },
        },
      },
    ]);

    let vipSold = 0, regSold = 0, vipRev = 0, regRev = 0, vipOrders = 0, regOrders = 0;
    for (const r of rows) {
      if (r._id === "vip") {
        vipSold = r.qty || 0; vipRev = r.revenue || 0; vipOrders = r.orders || 0;
      } else {
        regSold = r.qty || 0; regRev = r.revenue || 0; regOrders = r.orders || 0;
      }
    }

    const vipCapacity = Number(ev.vipTicketQuantity || 0);
    const regCapacity = Number(ev.ticketQuantity || 0);
    const vipRemaining = Math.max(0, vipCapacity - vipSold);
    const regRemaining = Math.max(0, regCapacity - regSold);

    const capacity = vipCapacity + regCapacity;
    const ticketsSold = vipSold + regSold;
    const remaining = vipRemaining + regRemaining;
    const revenue = vipRev + regRev;
    const orders = vipOrders + regOrders;
    const sellThrough = capacity > 0 ? +(ticketsSold / capacity * 100).toFixed(2) : 0;

    res.json({
      eventId: ev._id,
      title: ev.title,
      date: ev.date,
      time: ev.time,
      location: ev.location,
      category: ev.category,
      status: ev.status,
      vip: {
        price: ev.vipTicketPrice ?? 0,
        capacity: vipCapacity,
        sold: vipSold,
        remaining: vipRemaining,
        revenue: vipRev,
        orders: vipOrders,
      },
      regular: {
        price: ev.regularTicketPrice ?? 0,
        capacity: regCapacity,
        sold: regSold,
        remaining: regRemaining,
        revenue: regRev,
        orders: regOrders,
      },
      totals: {
        capacity,
        sold: ticketsSold,
        remaining,
        revenue,
        orders,
        sellThrough,
      },
    });
  } catch (err) {
    console.error("event metrics error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

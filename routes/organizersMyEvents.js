// routes/organizersMyEvents.js
const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();
const Event = require("../models/Event");

// Reuse the same verifier you already use elsewhere
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

// Ownership helper
function ownerFilter(email) {
  return { $or: [{ loggedinemail: email }, { email }] };
}

// GET /api/organizers/my-events (existing)
router.get("/my-events", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "10", 10)));
    const status = req.query.status;

    const where = status ? { ...ownerFilter(email), status } : ownerFilter(email);

    const [items, total] = await Promise.all([
      Event.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Event.countDocuments(where),
    ]);

    const shaped = items.map((ev) => ({
      ...ev,
      vipTickets: ev.vipTicketQuantity,
      regularTickets: ev.ticketQuantity,
      vipPrice: ev.vipTicketPrice,
      regularPrice: ev.regularTicketPrice,
    }));

    res.json({ page, limit, total, pages: Math.ceil(total / limit), events: shaped });
  } catch (err) {
    console.error("my-events error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/organizers/events/:id/status  { status: "Published" | "Draft" | "Cancelled" }
router.patch("/events/:id/status", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ["Draft", "Published", "Cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowed.join(", ")}` });
    }

    const ev = await Event.findOneAndUpdate(
      { _id: id, ...ownerFilter(email) },
      { $set: { status } },
      { new: true }
    ).lean();

    if (!ev) return res.status(404).json({ error: "Event not found or not owned by you" });

    const shaped = {
      ...ev,
      vipTickets: ev.vipTicketQuantity,
      regularTickets: ev.ticketQuantity,
      vipPrice: ev.vipTicketPrice,
      regularPrice: ev.regularTicketPrice,
    };

    res.json({ message: "Status updated", event: shaped });
  } catch (err) {
    console.error("status update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/organizers/events/:id
router.delete("/events/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    const { id } = req.params;

    const ev = await Event.findOneAndDelete({ _id: id, ...ownerFilter(email) }).lean();
    if (!ev) return res.status(404).json({ error: "Event not found or not owned by you" });

    res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("delete event error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// (Optional) PUT /api/organizers/events/:id  — quick metadata edits (title, time, etc.)
router.put("/events/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    const { id } = req.params;
    const allowed = [
      "title","subtitle","date","time","category","location","description",
      "image","imageUrl","videoUrl","vipTicketPrice","regularTicketPrice",
      "vipTicketQuantity","ticketQuantity","price","status"
    ];
    const $set = {};
    for (const k of allowed) {
      if (k in req.body) $set[k] = req.body[k];
    }
    if (Object.keys($set).length === 0) {
      return res.status(400).json({ error: "No permitted fields to update" });
    }

    const ev = await Event.findOneAndUpdate(
      { _id: id, ...ownerFilter(email) },
      { $set },
      { new: true, runValidators: true }
    ).lean();

    if (!ev) return res.status(404).json({ error: "Event not found or not owned by you" });

    const shaped = {
      ...ev,
      vipTickets: ev.vipTicketQuantity,
      regularTickets: ev.ticketQuantity,
      vipPrice: ev.vipTicketPrice,
      regularPrice: ev.regularTicketPrice,
    };

    res.json({ message: "Event updated", event: shaped });
  } catch (err) {
    console.error("update event error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

// routes/events.js
const express = require("express");
const router = express.Router();
const Event = require("../models/Event");

// GET all events
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET single event
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST a new event
router.post("/", async (req, res) => {
  try {
    // Coerce potential string inputs to numbers
    const cleaned = { ...req.body };
    ["vipTickets", "regularTickets", "vipPrice", "regularPrice"].forEach((k) => {
      if (cleaned[k] !== undefined) cleaned[k] = Number(cleaned[k]) || 0;
    });

    const event = new Event(cleaned);
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

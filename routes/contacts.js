// routes/contacts.js
const express = require("express");
const router = express.Router();
const ContactMessage = require("../models/ContactMessage");

// CREATE a contact message
router.post("/", async (req, res) => {
  try {
    const b = req.body || {};

    const payload = {
      firstName: String(b.firstName || "").trim(),
      lastName: String(b.lastName || "").trim(),
      mobile: String(b.mobile || "").trim(),
      email: String(b.email || "").trim(),
      message: String(b.message || "").trim(),
    };

    const required = ["firstName", "mobile", "email", "message"];
    for (const k of required) {
      if (!payload[k]) {
        return res.status(400).json({ error: `Missing required field: ${k}` });
      }
    }

    const created = await ContactMessage.create(payload);
    return res.status(201).json(created);
  } catch (err) {
    console.error("Create contact message error:", err);
    return res.status(500).json({ error: "Failed to submit message" });
  }
});

// READ ONE (optional)
router.get("/:id", async (req, res) => {
  try {
    const doc = await ContactMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Message not found" });
    res.json(doc);
  } catch (err) {
    console.error("Fetch contact message error:", err);
    res.status(400).json({ error: "Invalid id" });
  }
});

// LIST (optional)
router.get("/", async (_req, res) => {
  const docs = await ContactMessage.find().sort({ createdAt: -1 }).limit(200);
  res.json(docs);
});

module.exports = router;

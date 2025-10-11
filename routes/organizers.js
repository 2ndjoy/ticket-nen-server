// routes/organizers.js
const express = require("express");
const router = express.Router();
const Organizer = require("../models/Organizer");

// Upsert organizer by email
// POST /api/organizers/upsert
router.post("/upsert", async (req, res) => {
  try {
    const {
      email,
      firebaseUid,
      fullName,
      phoneNumber,
      nidNumber,
      organizationName,
      organizationType,
      division,
      district,
      area,
    } = req.body || {};

    // Basic checks
    const required = [
      "email",
      "fullName",
      "phoneNumber",
      "nidNumber",
      "organizationName",
      "organizationType",
      "division",
      "district",
      "area",
    ];
    for (const k of required) {
      if (!String((req.body || {})[k] || "").trim()) {
        return res.status(400).json({ error: `Missing required field: ${k}` });
      }
    }

    const updateDoc = {
      email: String(email).toLowerCase().trim(),
      firebaseUid: firebaseUid || undefined,
      fullName: String(fullName).trim(),
      phoneNumber: String(phoneNumber).trim(),
      nidNumber: String(nidNumber).trim(),
      organizationName: String(organizationName).trim(),
      organizationType: String(organizationType).trim(),
      division: String(division).trim(),
      district: String(district).trim(),
      area: String(area).trim(),
      role: "organizer",
      status: "active",
      createdFrom: "self-service",
    };

    const result = await Organizer.findOneAndUpdate(
      { email: updateDoc.email },
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    return res.json(result);
  } catch (err) {
    console.error("Organizer upsert error:", err);
    // handle unique key errors etc
    return res.status(500).json({ error: "Failed to upsert organizer" });
  }
});

// Optional: get current organizer profile by email (query ?email=)
router.get("/", async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "email query param required" });

    const doc = await Organizer.findOne({ email });
    if (!doc) return res.status(404).json({ error: "Organizer not found" });
    return res.json(doc);
  } catch (err) {
    console.error("Organizer get error:", err);
    return res.status(500).json({ error: "Failed to fetch organizer" });
  }
});

module.exports = router;

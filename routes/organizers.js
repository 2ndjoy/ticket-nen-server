// routes/organizers.js
const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();
const Organizer = require("../models/Organizer");

/* ----------------------------- helpers ---------------------------------- */

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.firebaseUid = decoded.uid;
    req.firebaseEmail = (decoded.email || "").toLowerCase().trim();
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const normalizeWebsite = (url) => {
  if (!url) return "";
  const t = String(url).trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
};

const REQUIRED_FIELDS = [
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

const pick = (obj, keys) =>
  keys.reduce((acc, k) => (k in obj ? ((acc[k] = obj[k]), acc) : acc), {});

/* --------------------------- SECURE /me APIs ----------------------------- */

/**
 * GET /api/organizers/me
 * Returns the organizer profile for the signed-in user (by Firebase token email).
 */
router.get("/me", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    const doc = await Organizer.findOne({ email }).lean();
    if (!doc) return res.status(404).json({ error: "Organizer not found" });
    return res.json(doc);
  } catch (err) {
    console.error("Organizer GET /me error:", err);
    return res.status(500).json({ error: "Failed to fetch organizer" });
  }
});

/**
 * PUT /api/organizers/me
 * Partial update supported. If profile does not exist yet, it will validate required fields.
 */
router.put("/me", verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.firebaseEmail;
    const firebaseUid = req.firebaseUid;
    if (!email) return res.status(400).json({ error: "Email not available on token" });

    // Fields an organizer can edit from the profile page
    const editable = [
      "fullName",
      "phoneNumber",
      "nidNumber",
      "organizationName",
      "organizationType",
      "division",
      "district",
      "area",
      "website",
      "description",
      "logoUrl",
      "facebook",
      "instagram",
      "twitter",
    ];

    const body = pick(req.body || {}, editable);
    if ("website" in body) body.website = normalizeWebsite(body.website);

    const existing = await Organizer.findOne({ email });

    if (!existing) {
      // Creating first time: ensure all required fields present (from your schema)
      const missing = REQUIRED_FIELDS.filter(
        (k) => !String((k === "email" ? email : body[k]) || "").trim()
      );
      if (missing.length) {
        return res.status(400).json({
          error: `Missing required field(s): ${missing.join(", ")}`,
        });
      }

      const doc = await Organizer.create({
        ...body,
        email,
        firebaseUid,
        role: "organizer",
        status: "active",
        createdFrom: "self-service",
      });

      return res.json(doc);
    }

    // Updating existing: merge partial fields and keep role/status stable
    const updateDoc = {
      ...body,
      firebaseUid,
      role: existing.role || "organizer",
      status: existing.status || "active",
    };

    const updated = await Organizer.findOneAndUpdate(
      { email },
      { $set: updateDoc },
      { new: true, runValidators: true }
    );

    return res.json(updated);
  } catch (err) {
    console.error("Organizer PUT /me error:", err);
    return res.status(500).json({ error: "Failed to save organizer profile" });
  }
});

/* ---------------- EXISTING public-ish endpoints (kept) ------------------- */

/**
 * POST /api/organizers/upsert
 * Upsert organizer by email (original behavior). Useful for your registration flow.
 */
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
    for (const k of REQUIRED_FIELDS) {
      if (!String((k === "email" ? email : (req.body || {})[k]) || "").trim()) {
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
      { upsert: true, new: true, runValidators: true }
    );

    return res.json(result);
  } catch (err) {
    console.error("Organizer upsert error:", err);
    // Handle duplicate key, etc., if needed
    return res.status(500).json({ error: "Failed to upsert organizer" });
  }
});

/**
 * GET /api/organizers?email=you@example.com
 * Fetch organizer by email (original behavior).
 */
router.get("/", async (req, res) => {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "email query param required" });

    const doc = await Organizer.findOne({ email }).lean();
    if (!doc) return res.status(404).json({ error: "Organizer not found" });
    return res.json(doc);
  } catch (err) {
    console.error("Organizer get error:", err);
    return res.status(500).json({ error: "Failed to fetch organizer" });
  }
});

module.exports = router;

// routes/users.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("../models/User");
const verifyFirebaseToken = require("../middlewares/verifyFirebaseToken");

/**
 * Helper: require admin claim
 */
function requireAdmin(req, res, next) {
  const isAdmin = !!(req.firebaseClaims && (req.firebaseClaims.admin || req.firebaseClaims.role === "admin"));
  if (!isAdmin) return res.status(403).json({ error: "Admin only" });
  return next();
}

/**
 * POST /  (Upsert own profile)
 * Body: { uid, fullName, email, phoneNumber, imageUrl }
 * Protected: yes
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  const { uid, fullName, email, phoneNumber, imageUrl } = req.body;

  // Ensure the UID from the token matches the payload UID
  if (uid !== req.firebaseUid) {
    return res.status(403).json({ error: "UID mismatch" });
  }

  try {
    const user = await User.findOneAndUpdate(
      { uid },
      { fullName, email, phoneNumber, imageUrl },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * GET /me  (Get own profile)
 * Protected: yes
 */
router.get("/me", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUid;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    console.error("GET /me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /:id  (Admin deletes a user by Mongo _id)
 * Protected: admin only
 * NOTE: If this router is mounted at /api/admin/users, this path becomes /api/admin/users/:id
 */
router.delete("/:id", verifyFirebaseToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.status(204).end();
  } catch (err) {
    console.error("DELETE /users/:id error:", err);
    // If you didn't import mongoose, you'd catch CastError here instead.
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

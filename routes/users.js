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
  const claims = req.firebaseClaims || {};
  const isAdmin = !!(claims.admin || claims.role === "admin");
  if (!isAdmin) return res.status(403).json({ error: "Admin only" });
  return next();
}

/**
 * POST /  (Upsert own profile)
 * Body: { fullName, phoneNumber, imageUrl }   // uid & email come from token
 * Protected: yes
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  const { fullName, phoneNumber, imageUrl } = req.body;
  const { uid, email } = req.firebaseClaims || {};

  if (!uid || !email) {
    return res.status(400).json({ error: "Token missing uid/email" });
  }
  if (!fullName) {
    return res.status(400).json({ error: "fullName is required" });
  }

  try {
    const user = await User.findOneAndUpdate(
      { uid }, // query by Firebase UID
      { fullName, email, phoneNumber, imageUrl },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, user });
  } catch (err) {
    console.error("DB error:", err);

    // Handle duplicate key errors nicely
    if (err?.code === 11000) {
      // figure out which field conflicted
      const fields = Object.keys(err.keyPattern || {});
      return res.status(409).json({
        error: `Duplicate value for unique field(s): ${fields.join(", ")}`,
        fields,
      });
    }

    return res.status(500).json({ error: "Database error" });
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
    return res.json({ success: true, user });
  } catch (err) {
    console.error("GET /me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /:id  (Admin deletes a user by Mongo _id)
 * Protected: admin only
 * NOTE: If this router is mounted at /api/users, path is /api/users/:id
 *       If mounted under /api/admin/users, path becomes /api/admin/users/:id
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
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

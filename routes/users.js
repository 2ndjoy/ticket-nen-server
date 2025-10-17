const express = require("express");
const router = express.Router();
const User = require("../models/User");
const verifyFirebaseToken = require("../middlewares/verifyFirebaseToken");

// 🔐 Protect routes
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

// 🔐 GET profile
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



// DELETE /api/admin/users/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  // Option A: strict ObjectId check
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
    console.error(err);
    // If you prefer not to import mongoose above, you can catch CastError:
    // if (err?.name === "CastError") return res.status(400).json({ error: "Invalid user id" });
    return res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;

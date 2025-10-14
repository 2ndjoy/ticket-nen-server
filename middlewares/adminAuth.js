// middleware/adminAuth.js
const admin = require("firebase-admin");
const User = require("../models/User");

const envEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(m[1]);
    req.firebaseUid = decoded.uid;
    req.firebaseEmail = (decoded.email || "").toLowerCase();
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const email = (req.firebaseEmail || "").toLowerCase();
    if (!email) return res.status(403).json({ error: "Forbidden" });

    // 1) allowlisted emails
    if (envEmails.includes(email)) return next();

    // 2) DB role check (optional fallback)
    const user = await User.findOne({ email }).lean();
    if (user?.role === "admin") return next();

    return res.status(403).json({ error: "Admins only" });
  } catch (e) {
    return res.status(500).json({ error: "Admin check failed" });
  }
}

module.exports = { verifyFirebaseToken, requireAdmin };

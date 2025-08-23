// middlewares/verifyFirebaseToken.js
const admin = require("firebase-admin");

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: "No token provided" });

  const idToken = match[1];
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // 👉 Reject if email has not yet been verified
  if (!decoded.email_verified) {
    return res
      .status(403)
      .json({ error: "Email not verified. Please check your inbox." });
  }

  req.firebaseUid = decoded.uid;
  next();
};

module.exports = verifyFirebaseToken;

const admin = require("firebase-admin");

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);

  if (!match) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.firebaseUid = decoded.uid;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = verifyFirebaseToken;

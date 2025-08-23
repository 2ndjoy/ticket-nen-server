require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Firebase setup (optional if you want auth)
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB error:", err));

// Auth middleware (optional)
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

// Mount routes
app.use("/api/events", require("./routes/events"));

// Add after other app.use() lines
app.use("/api/bookings", require("./routes/bookings"));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

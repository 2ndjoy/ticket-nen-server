// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const app = express();

/* =========================
   Basic App Middleware
========================= */
app.set("trust proxy", 1);

// CORS: allow all by default, or restrict via env
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    credentials: true,
  })
);

// JSON body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   Firebase Admin Init
   - Prefers GOOGLE_APPLICATION_CREDENTIALS
   - Falls back to ./serviceAccountKey.json if present
========================= */
(() => {
  if (admin.apps.length) return;

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Using Application Default Credentials (recommended in prod)
      admin.initializeApp();
      console.log("✅ Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS");
      return;
    }

    // Fallback to local service account key file
    const keyPath = path.resolve(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(keyPath)) {
      const serviceAccount = require(keyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialized via serviceAccountKey.json");
      return;
    }

    console.warn(
      "⚠️ Firebase Admin not initialized (no GOOGLE_APPLICATION_CREDENTIALS and no serviceAccountKey.json). " +
        "If you need auth, set one of them."
    );
  } catch (err) {
    console.error("❌ Firebase Admin init error:", err);
  }
})();

/* =========================
   MongoDB (Mongoose) Init
========================= */
mongoose.set("strictQuery", true);

// If you want Mongoose to build indexes in prod (e.g., the unique index on Booking):
// Set MONGOOSE_AUTO_INDEX=true in your .env (default false in production).
const shouldAutoIndex =
  String(process.env.MONGOOSE_AUTO_INDEX || "").toLowerCase() === "true";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/eventsdb";

mongoose
  .connect(MONGODB_URI, {
    autoIndex: shouldAutoIndex, // default false in prod
  })
  .then(async () => {
    console.log("✅ MongoDB connected");

    // Ensure models are registered before potential index builds
    // (so unique index on bookings gets created if autoIndex=true)
    require("./models/Event");
    require("./models/Booking");

    if (shouldAutoIndex) {
      console.log("ℹ️  Mongoose autoIndex is ENABLED. Building indexes if needed...");
      try {
        // Build indexes explicitly (optional)
        await Promise.all([
          mongoose.model("Event").syncIndexes(),
          mongoose.model("Booking").syncIndexes(),
        ]);
        console.log("✅ Index sync complete");
      } catch (e) {
        console.error("❌ Index sync error:", e);
      }
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* =========================
   Health/Info Routes
========================= */
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    name: "Events API",
    version: "1.0.0",
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

/* =========================
   API Routes
========================= */
// Your route files (make sure these files exist)
const eventsRouter = require("./routes/events");
const bookingsRouter = require("./routes/bookings"); // contains its own Firebase token verification
const promoteEventsRoute = require("./routes/promoteEvents");
const organizersRoute = require("./routes/organizers");
const contactsRoute = require("./routes/contacts");

// Mount under /api/*
app.use("/api/events", eventsRouter);          // GET/POST events, GET /:id
app.use("/api/bookings", bookingsRouter);      // POST bookings, GET my-bookings
app.use("/api/events", promoteEventsRoute);    // e.g., /api/events/promote (your existing file)
app.use("/api/organizers", organizersRoute);
app.use("/api/contacts", contactsRoute);

const organizersMyEventsRouter = require("./routes/organizersMyEvents");
app.use("/api/organizers", organizersMyEventsRouter);

const organizersMetricsRouter = require("./routes/organizersMetrics");
app.use("/api/organizers", organizersMetricsRouter);


/* =========================
   404 + Error Handlers
========================= */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.status(404).send("Not found");
});

// Centralized error handler
// If any route calls next(err), it will end here.
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

/* =========================
   Graceful Shutdown
========================= */
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${server.address().port}`);
});

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  try {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
  } catch (e) {
    console.error("Mongo close error:", e);
  }
  server.close(() => {
    console.log("👋 Bye!");
    process.exit(0);
  });
});

// scripts/migrateTicketsToNumbers.js
require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI; // mongodb+srv://...
const dbName = process.env.MONGODB_DB || undefined;

async function main() {
  await mongoose.connect(uri, dbName ? { dbName } : {});

  const Event = mongoose.connection.collection("events");

  // Backup raw fields (only if not present)
  await Event.updateMany(
    {
      $or: [
        { vipTickets: { $type: "string" } },
        { regularTickets: { $type: "string" } },
        { vipPrice: { $type: "string" } },
        { regularPrice: { $type: "string" } },
      ],
      vipTickets_raw: { $exists: false }
    },
    [
      { $set: {
          vipTickets_raw: "$vipTickets",
          regularTickets_raw: "$regularTickets",
          vipPrice_raw: "$vipPrice",
          regularPrice_raw: "$regularPrice",
      }}
    ]
  );

  const extractNumber = (v, isPrice = false) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    const str = String(v);
    const m = str.match(/\d+(\.\d+)?/);
    const n = m ? Number(m[0]) : 0;
    return isPrice ? n : Math.trunc(n);
  };

  const cursor = Event.find({}).project({
    _id: 1, vipTickets: 1, regularTickets: 1, vipPrice: 1, regularPrice: 1
  }).stream();

  let updated = 0;
  for await (const ev of cursor) {
    const patch = {
      vipTickets: extractNumber(ev.vipTickets, false),
      regularTickets: extractNumber(ev.regularTickets, false),
      vipPrice: extractNumber(ev.vipPrice, true),
      regularPrice: extractNumber(ev.regularPrice, true),
    };

    const needsUpdate =
      (typeof ev.vipTickets !== "number") ||
      (typeof ev.regularTickets !== "number") ||
      (typeof ev.vipPrice !== "number") ||
      (typeof ev.regularPrice !== "number");

    if (needsUpdate) {
      await Event.updateOne({ _id: ev._id }, { $set: patch });
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} event(s).`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

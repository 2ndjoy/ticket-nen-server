// quick-test.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("DB:", mongoose.connection.name);

  const doc = await User.findOneAndUpdate(
    { uid: "debug-uid" },
    { uid: "debug-uid", fullName: "Debug User", email: "debug@example.com" },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Wrote:", { _id: doc._id.toString(), uid: doc.uid });
  await mongoose.disconnect();
})();

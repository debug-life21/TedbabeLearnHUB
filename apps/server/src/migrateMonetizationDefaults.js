/**
 * Backfill monetization defaults onto documents that predate the pricing fields.
 *
 * Documents created before Course.isFree existed are missing the field, so a
 * query for { isFree: true } would not match them. This migration writes the
 * schema defaults explicitly:
 *   - Course.isFree      -> true   (every legacy course stays free)
 *   - Course.priceSantim -> 0
 *   - Course.currency    -> "ETB"
 *   - User.lastActiveAt  -> null   (explicit, so activity analytics can group)
 *
 * Idempotent: re-running it makes no further changes.
 *
 * Usage: MONGO_URI=... node src/migrateMonetizationDefaults.js
 */
import mongoose from "mongoose";
import { CourseModel } from "./models/Course.js";
import { UserModel } from "./models/User.js";
import { env } from "./config.js";

async function run() {
    await mongoose.connect(env.MONGODB_URI);
    console.log(`[migrate] connected to ${env.MONGODB_URI.replace(/\/\/.*@/, "//***@")}`);

    const courseResult = await CourseModel.updateMany(
        { $or: [{ isFree: { $exists: false } }, { currency: { $exists: false } }] },
        { $set: { isFree: true, priceSantim: 0, currency: "ETB" } },
    );
    console.log(`[migrate] courses: matched ${courseResult.matchedCount}, modified ${courseResult.modifiedCount}`);

    const userResult = await UserModel.updateMany(
        { $or: [{ lastActiveAt: { $exists: false } }, { lastLoginAt: { $exists: false } }] },
        { $set: { lastActiveAt: null, lastLoginAt: null } },
    );
    console.log(`[migrate] users: matched ${userResult.matchedCount}, modified ${userResult.modifiedCount}`);

    const remainingPaid = await CourseModel.countDocuments({ isFree: false });
    console.log(`[migrate] completed. courses currently marked paid: ${remainingPaid}`);
    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error("[migrate] failed:", error);
    await mongoose.disconnect();
    process.exitCode = 1;
});

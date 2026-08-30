#!/usr/bin/env node
//
// Database migration and back-fill.
//
// Run with:  npm run migrate           (apply)
//            npm run migrate -- --dry  (report what would change, write nothing)
//
// The application changes in this release add fields, tighten types and — most
// importantly — make donation history the source of truth for donor eligibility. Existing
// databases predate all of that, so this script brings them forward. Every step is
// idempotent: running it twice is safe and the second run reports zero changes.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const dbConnection = require('../utils/db');
const { seedRoles } = require('../controllers/role');
const User = require('../models/User');
const Donor = require('../models/Donor');
const DonationRequest = require('../models/DonationRequest');
const DonationHistory = require('../models/DonationHistory');
const MedicalReport = require('../models/MedicalReport');
const BloodInventory = require('../models/BloodInventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const password = require('../utils/password');

const DRY_RUN = process.argv.includes('--dry');
const log = (step, message) => console.log(`  ${DRY_RUN ? '[dry] ' : ''}${step}: ${message}`);

// ---------------------------------------------------------------------------

// 1. Roles. Authorization now reads permission flags, so the roles must exist.
const migrateRoles = async () => {
    if (DRY_RUN) {
        const Roles = require('../models/Roles');
        const existing = await Roles.countDocuments();
        return log('roles', `${existing} role(s) present; seeding would ensure admin, donor and hospital exist`);
    }
    const results = await seedRoles();
    log('roles', results.map(r => `${r.userRole}=${r.action}`).join(', '));
};

// 2. Account status. `isActive` was a Number defaulting to 0 and nothing ever read it.
// Now it gates sign-in, so leaving legacy rows at 0 would lock out every existing user.
// Accounts that predate this release were usable, so they are marked active.
const migrateAccountStatus = async () => {
    const collection = mongoose.connection.collection('users');
    const legacy = await collection.countDocuments({ $or: [{ isActive: { $type: 'number' } }, { isActive: { $exists: false } }] });
    if (DRY_RUN) return log('account status', `${legacy} user(s) would be normalised to isActive: true`);
    if (!legacy) return log('account status', 'nothing to normalise');

    const result = await collection.updateMany(
        { $or: [{ isActive: { $type: 'number' } }, { isActive: { $exists: false } }] },
        { $set: { isActive: true } }
    );
    log('account status', `${result.modifiedCount} user(s) normalised to isActive: true`);
};

// 3. Verification. Verification is new, so existing accounts have never been asked for a
// code. Marking them verified preserves their access; new registrations still verify.
const migrateVerification = async () => {
    const filter = { isVerified: { $exists: false } };
    const count = await User.countDocuments(filter);
    if (DRY_RUN) return log('verification', `${count} pre-existing account(s) would be marked verified`);
    if (!count) return log('verification', 'nothing to back-fill');

    const result = await User.updateMany(filter, {
        $set: { isVerified: true, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date() }
    });
    log('verification', `${result.modifiedCount} pre-existing account(s) marked verified`);
};

// 4. Referral codes for accounts that predate the referral programme.
const migrateReferralCodes = async () => {
    const users = await User.find({ $or: [{ referralCode: { $exists: false } }, { referralCode: null }] }).select('_id');
    if (DRY_RUN) return log('referrals', `${users.length} account(s) would receive an invitation code`);
    if (!users.length) return log('referrals', 'nothing to back-fill');

    let assigned = 0;
    for (const user of users) {
        // Collisions are astronomically unlikely but the field is unique, so retry.
        for (let attempt = 0; attempt < 5; attempt++) {
            const code = password.generateToken(4).toUpperCase();
            try {
                await User.updateOne({ _id: user._id }, { $set: { referralCode: code, referralCount: 0 } });
                assigned++;
                break;
            } catch (err) {
                if (err.code !== 11000) throw err;
            }
        }
    }
    log('referrals', `${assigned} invitation code(s) assigned`);
};

// 5. User.locationGeo was declared as a String path, so any coordinates written to it
// were discarded and some documents hold a bare string. A malformed value now fails
// GeoJSON validation on save, so it is removed; the authoritative copy lives on
// UserProfile.locationGeo, which was always correct.
const migrateLocationGeo = async () => {
    const collection = mongoose.connection.collection('users');
    const filter = {
        $or: [
            { locationGeo: { $type: 'string' } },
            { locationGeo: { $type: 'object' }, 'locationGeo.coordinates': { $exists: false } }
        ]
    };
    const count = await collection.countDocuments(filter);
    if (DRY_RUN) return log('locationGeo', `${count} user document(s) hold an unusable location and would be cleared`);
    if (!count) return log('locationGeo', 'no malformed locations found');

    const result = await collection.updateMany(filter, { $unset: { locationGeo: '' } });
    log('locationGeo', `${result.modifiedCount} unusable location(s) cleared`);
};

// 6. Donation history back-fill — the important one.
//
// Donations were only ever recorded on the donation request, as a volunteer marked
// `donationSuccess: true`. Nothing wrote a DonationHistory row, so donor eligibility, the
// aggregate report and eligible-donor targeting all read an empty collection and every
// donor appeared permanently eligible. This reconstructs the missing rows from the
// volunteer records that already exist.
const backfillDonationHistory = async () => {
    const requests = await DonationRequest.find({ 'volunteers.0': { $exists: true } }).lean();

    const candidates = [];
    for (const request of requests) {
        for (const volunteer of request.volunteers || []) {
            // Treat an explicit success, or a fulfilled volunteer on a completed request,
            // as a donation that happened.
            const donated = volunteer.donationSuccess === true ||
                (volunteer.fulfilled === true && String(request.status).toUpperCase() === 'COMPLETED');
            if (!donated || !volunteer.donorId) continue;

            candidates.push({
                requestId: String(request._id),
                userId: String(volunteer.donorId),
                hospitalId: request.hospitalId ? String(request.hospitalId) : undefined,
                donationDate: volunteer.confirmedAt || volunteer.expectedDonationTime
                    || request.fulfilledAt || request.requestDate || new Date(),
                units: volunteer.unitsDonated || 1,
                bloodGroup: request.bloodGroup
            });
        }
    }

    // Skip any donation already recorded, so a repeat run adds nothing.
    const existing = await DonationHistory.find({
        requestId: { $in: candidates.map(c => c.requestId) }
    }).select('requestId userId').lean();
    const seen = new Set(existing.map(e => `${e.requestId}|${e.userId}`));
    const missing = candidates.filter(c => !seen.has(`${c.requestId}|${c.userId}`));

    if (DRY_RUN) {
        return log('donation history', `${missing.length} donation(s) would be reconstructed from ${candidates.length} confirmed volunteer record(s)`);
    }
    if (!missing.length) return log('donation history', 'already complete');

    let created = 0;
    for (const c of missing) {
        try {
            await DonationHistory.create({
                donationId: `DN-BACKFILL-${c.requestId.slice(-6)}-${c.userId.slice(-6)}`,
                userId: c.userId,
                hospitalId: c.hospitalId,
                requestId: c.requestId,
                donationDate: c.donationDate,
                donatedUnits: c.units,
                donationType: 'Whole Blood',
                status: 'Success',
                remarks: 'Reconstructed from the donation request volunteer record during migration'
            });
            created++;
        } catch (err) {
            // The unique (requestId, userId) index makes a concurrent insert harmless.
            if (err.code !== 11000) throw err;
        }
    }
    log('donation history', `${created} donation(s) reconstructed`);
};

// 7. Medical reports for donations that carried a proof file but no report record.
const backfillMedicalReports = async () => {
    const requests = await DonationRequest.find({ 'volunteers.medicalProofFile': { $exists: true, $ne: null } }).lean();

    const candidates = [];
    for (const request of requests) {
        for (const volunteer of request.volunteers || []) {
            if (!volunteer.medicalProofFile || volunteer.medicalReportId || !volunteer.donorId) continue;
            candidates.push({ request, volunteer });
        }
    }

    if (DRY_RUN) return log('medical reports', `${candidates.length} proof file(s) would become medical report records`);
    if (!candidates.length) return log('medical reports', 'nothing to back-fill');

    let created = 0;
    for (const { request, volunteer } of candidates) {
        const existing = await MedicalReport.findOne({ requestId: String(request._id), userId: String(volunteer.donorId) });
        if (existing) continue;

        const report = await MedicalReport.create({
            reportId: `MR-BACKFILL-${String(request._id).slice(-6)}-${String(volunteer.donorId).slice(-6)}`,
            userId: String(volunteer.donorId),
            hospitalId: request.hospitalId ? String(request.hospitalId) : undefined,
            requestId: String(request._id),
            reportDate: volunteer.confirmedAt || volunteer.volunteeredAt || request.requestDate,
            reportType: 'Post-Donation',
            filePath: volunteer.medicalProofFile,
            isEligible: volunteer.donationSuccess !== false,
            testResult: 'Reconstructed from an uploaded proof of donation during migration'
        });

        await DonationRequest.updateOne(
            { _id: request._id, 'volunteers.donorId': volunteer.donorId },
            { $set: { 'volunteers.$.medicalReportId': String(report._id) } }
        );
        created++;
    }
    log('medical reports', `${created} report(s) created from existing proof files`);
};

// 8. Opening blood inventory, derived from the donations reconstructed above so the
// stock figures are consistent with the donation record from day one.
const backfillInventory = async () => {
    const existingStock = await BloodInventory.countDocuments();
    if (existingStock > 0) return log('inventory', `${existingStock} stock line(s) already present; leaving untouched`);

    const donations = await DonationHistory.find({
        status: 'Success', hospitalId: { $exists: true, $ne: null }
    }).lean();
    if (!donations.length) return log('inventory', 'no donations to derive opening stock from');

    // Resolve each donor's blood group; the donation record does not carry it.
    const donorIds = [...new Set(donations.map(d => d.userId))];
    const donors = await Donor.find({ userId: { $in: donorIds } }).select('userId bloodGroup').lean();
    const groupByUser = new Map(donors.map(d => [String(d.userId), d.bloodGroup]));

    const buckets = new Map();
    for (const donation of donations) {
        const group = groupByUser.get(String(donation.userId));
        if (!group) continue;
        const key = `${donation.hospitalId}|${group}`;
        buckets.set(key, (buckets.get(key) || 0) + (donation.donatedUnits || 1));
    }

    if (DRY_RUN) return log('inventory', `${buckets.size} opening stock line(s) would be created from ${donations.length} donation(s)`);

    let created = 0;
    for (const [key, units] of buckets) {
        const [hospitalId, bloodGroup] = key.split('|');
        await BloodInventory.create({ hospitalId, bloodGroup, unitsAvailable: units, unitsReserved: 0 });
        await InventoryTransaction.create({
            hospitalId, bloodGroup, type: 'IN', units, balanceAfter: units,
            note: 'Opening balance derived from historical donations during migration'
        });
        created++;
    }
    log('inventory', `${created} opening stock line(s) created`);
};

// 9. Indexes. Mongoose creates these lazily on first use; building them here makes the
// first production request fast rather than triggering a collection scan.
const syncIndexes = async () => {
    if (DRY_RUN) return log('indexes', 'indexes would be synchronised for all models');
    const models = [User, Donor, DonationRequest, DonationHistory, MedicalReport, BloodInventory, InventoryTransaction];
    for (const model of models) {
        await model.syncIndexes();
    }
    log('indexes', `${models.length} model(s) synchronised`);
};

// ---------------------------------------------------------------------------

const run = async () => {
    console.log(DRY_RUN
        ? '\nBlood Donation Management System — migration DRY RUN (no changes will be written)\n'
        : '\nBlood Donation Management System — running migration\n');

    await dbConnection();

    const steps = [
        migrateRoles,
        migrateAccountStatus,
        migrateVerification,
        migrateReferralCodes,
        migrateLocationGeo,
        backfillDonationHistory,
        backfillMedicalReports,
        backfillInventory,
        syncIndexes
    ];

    for (const step of steps) {
        try {
            await step();
        } catch (err) {
            console.error(`  FAILED at ${step.name}:`, err.message || err);
            await mongoose.disconnect();
            process.exit(1);
        }
    }

    console.log(DRY_RUN ? '\nDry run complete. Re-run without --dry to apply.\n' : '\nMigration complete.\n');
    await mongoose.disconnect();
    process.exit(0);
};

run();

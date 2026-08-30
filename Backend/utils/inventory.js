// Blood inventory service.
//
// Implements the "real-time blood inventory" the synopsis names in its Introduction,
// Objectives and Admin Dashboard module. Every balance change goes through here so that
// BloodInventory (the current level) and InventoryTransaction (the ledger) can never
// drift apart, and so low-stock alerts fire from one place.

const BloodInventory = require('../models/BloodInventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Hospital = require('../models/Hospital');
const { normalize } = require('./bloodCompatibility');
const notify = require('./notify');

// Whole blood is transfusable for roughly 42 days after collection.
const SHELF_LIFE_DAYS = 42;

const shelfLifeExpiry = (from = new Date()) =>
    new Date(from.getTime() + SHELF_LIFE_DAYS * 24 * 60 * 60 * 1000);

const getOrCreateStock = async (hospitalId, bloodGroup) => {
    const group = normalize(bloodGroup);
    if (!group) throw Object.assign(new Error(`Unrecognised blood group: ${bloodGroup}`), { status: 400 });

    // Upsert so two concurrent donations for the same hospital/group cannot both insert.
    return BloodInventory.findOneAndUpdate(
        { hospitalId, bloodGroup: group },
        { $setOnInsert: { hospitalId, bloodGroup: group, unitsAvailable: 0, unitsReserved: 0 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
};

// Alert administrators when a hospital drops below its reorder threshold.
// Failures here are logged, never propagated — a notification must not undo a stock move.
const checkLowStock = async (stock) => {
    try {
        if (!stock || stock.unitsAvailable > stock.reorderThreshold) return;
        const hospital = await Hospital.findById(stock.hospitalId).lean();
        await notify.events.lowInventory(hospital, stock.bloodGroup, stock.unitsAvailable, stock.reorderThreshold);
    } catch (err) {
        console.warn('[inventory] low-stock alert failed:', err.message || err);
    }
};

// Add units to stock — a donation was collected, or an administrator restocked.
const recordIn = async ({ hospitalId, bloodGroup, units = 1, donationId, requestId, donorUserId, performedBy, note }) => {
    const qty = Number(units);
    if (!Number.isFinite(qty) || qty <= 0) {
        throw Object.assign(new Error('Units must be greater than zero'), { status: 400 });
    }
    const group = normalize(bloodGroup);
    const stock = await BloodInventory.findOneAndUpdate(
        { hospitalId, bloodGroup: group },
        {
            $inc: { unitsAvailable: qty },
            $set: { lastRestockedAt: new Date() },
            $setOnInsert: { hospitalId, bloodGroup: group, unitsReserved: 0 }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await InventoryTransaction.create({
        hospitalId, bloodGroup: group, type: 'IN', units: qty,
        balanceAfter: stock.unitsAvailable,
        donationId, requestId, donorUserId, performedBy, note,
        expiryDate: shelfLifeExpiry()
    });

    return stock;
};

// Remove units from stock — issued to a patient, discarded, or expired.
const recordOut = async ({ hospitalId, bloodGroup, units = 1, requestId, performedBy, note, type = 'OUT', allowNegative = false }) => {
    const qty = Number(units);
    if (!Number.isFinite(qty) || qty <= 0) {
        throw Object.assign(new Error('Units must be greater than zero'), { status: 400 });
    }
    const group = normalize(bloodGroup);

    // The filter carries the balance check, so the decrement and the check are one atomic
    // operation. A conditional read-then-write could let two concurrent issues both pass.
    const filter = { hospitalId, bloodGroup: group };
    if (!allowNegative) filter.unitsAvailable = { $gte: qty };

    const stock = await BloodInventory.findOneAndUpdate(
        filter,
        { $inc: { unitsAvailable: -qty }, $set: { lastIssuedAt: new Date() } },
        { new: true }
    );

    if (!stock) {
        const current = await BloodInventory.findOne({ hospitalId, bloodGroup: group }).lean();
        throw Object.assign(
            new Error(`Insufficient stock: ${current ? current.unitsAvailable : 0} unit(s) of ${group} available, ${qty} requested`),
            { status: 409 }
        );
    }

    await InventoryTransaction.create({
        hospitalId, bloodGroup: group, type, units: qty,
        balanceAfter: stock.unitsAvailable, requestId, performedBy, note
    });

    await checkLowStock(stock);
    return stock;
};

// Hold units against an approved request without issuing them yet.
const reserve = async ({ hospitalId, bloodGroup, units = 1, requestId, performedBy, note }) => {
    const qty = Number(units);
    const group = normalize(bloodGroup);

    const stock = await BloodInventory.findOneAndUpdate(
        // Only reserve what is genuinely free: available minus what is already reserved.
        { hospitalId, bloodGroup: group, $expr: { $gte: [{ $subtract: ['$unitsAvailable', '$unitsReserved'] }, qty] } },
        { $inc: { unitsReserved: qty } },
        { new: true }
    );

    if (!stock) {
        throw Object.assign(new Error(`Not enough unreserved ${group} stock to reserve ${qty} unit(s)`), { status: 409 });
    }

    await InventoryTransaction.create({
        hospitalId, bloodGroup: group, type: 'RESERVE', units: qty,
        balanceAfter: stock.unitsAvailable, requestId, performedBy, note
    });
    return stock;
};

// Give back a hold, e.g. when a request is rejected or closed unfulfilled.
const release = async ({ hospitalId, bloodGroup, units = 1, requestId, performedBy, note }) => {
    const qty = Number(units);
    const group = normalize(bloodGroup);

    const stock = await BloodInventory.findOneAndUpdate(
        { hospitalId, bloodGroup: group, unitsReserved: { $gte: qty } },
        { $inc: { unitsReserved: -qty } },
        { new: true }
    );
    if (!stock) return null; // nothing was reserved; releasing is a no-op

    await InventoryTransaction.create({
        hospitalId, bloodGroup: group, type: 'RELEASE', units: qty,
        balanceAfter: stock.unitsAvailable, requestId, performedBy, note
    });
    return stock;
};

// Retire stock whose shelf life has passed. Intended to run on a schedule; also exposed
// to administrators so it can be triggered from the dashboard.
const expireStock = async (now = new Date()) => {
    const due = await InventoryTransaction.find({
        type: 'IN', expired: false, expiryDate: { $lte: now }
    }).lean();

    const results = [];
    for (const batch of due) {
        try {
            // allowNegative: the units may already have been issued, in which case the
            // balance is correct and only the batch needs marking.
            await recordOut({
                hospitalId: batch.hospitalId,
                bloodGroup: batch.bloodGroup,
                units: batch.units,
                type: 'EXPIRED',
                note: `Shelf life reached for batch ${batch._id}`,
                allowNegative: true
            });
            await InventoryTransaction.updateOne({ _id: batch._id }, { $set: { expired: true } });
            results.push({ batchId: String(batch._id), bloodGroup: batch.bloodGroup, units: batch.units });
        } catch (err) {
            console.warn('[inventory] failed to expire batch', String(batch._id), err.message || err);
        }
    }
    return results;
};

module.exports = {
    SHELF_LIFE_DAYS,
    shelfLifeExpiry,
    getOrCreateStock,
    recordIn,
    recordOut,
    reserve,
    release,
    expireStock,
    checkLowStock
};

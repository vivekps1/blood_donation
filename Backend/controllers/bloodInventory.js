// Blood inventory management — the stock side of the Admin Dashboard module.

const BloodInventory = require('../models/BloodInventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Hospital = require('../models/Hospital');
const inventory = require('../utils/inventory');
const { BLOOD_GROUPS, normalize, compatibleDonorGroups } = require('../utils/bloodCompatibility');

const actor = (req) => (req.user && req.user.userId ? String(req.user.userId) : undefined);

// GET /api/v1/inventory
// Current stock, optionally narrowed to one hospital or blood group.
exports.getInventory = async (req, res, next) => {
    try {
        const { hospitalId, bloodGroup, lowStockOnly } = req.query;
        const filter = {};
        if (hospitalId) filter.hospitalId = hospitalId;
        if (bloodGroup && bloodGroup !== 'all') {
            const group = normalize(bloodGroup);
            if (!group) return res.status(400).json({ message: `Unrecognised blood group: ${bloodGroup}` });
            filter.bloodGroup = group;
        }

        let stock = await BloodInventory.find(filter)
            .populate('hospitalId', 'hospitalName address city phoneNumber isVerified')
            .sort({ bloodGroup: 1 })
            .lean();

        if (lowStockOnly === 'true' || lowStockOnly === '1') {
            stock = stock.filter(s => (s.unitsAvailable || 0) <= (s.reorderThreshold || 0));
        }

        // Recompute the virtual, which does not survive .lean().
        stock = stock.map(s => ({ ...s, unitsFree: Math.max(0, (s.unitsAvailable || 0) - (s.unitsReserved || 0)) }));

        const totals = BLOOD_GROUPS.reduce((acc, group) => {
            const rows = stock.filter(s => s.bloodGroup === group);
            acc[group] = {
                unitsAvailable: rows.reduce((n, r) => n + (r.unitsAvailable || 0), 0),
                unitsReserved: rows.reduce((n, r) => n + (r.unitsReserved || 0), 0)
            };
            return acc;
        }, {});

        res.status(200).json({
            stock,
            totals,
            summary: {
                totalUnits: stock.reduce((n, s) => n + (s.unitsAvailable || 0), 0),
                totalReserved: stock.reduce((n, s) => n + (s.unitsReserved || 0), 0),
                lowStockCount: stock.filter(s => (s.unitsAvailable || 0) <= (s.reorderThreshold || 0)).length,
                hospitalsTracked: new Set(stock.map(s => String(s.hospitalId && s.hospitalId._id ? s.hospitalId._id : s.hospitalId))).size
            }
        });
    } catch (err) { next(err); }
};

// GET /api/v1/inventory/availability?bloodGroup=A+&hospitalId=...
// What can actually be transfused into a patient of this group — the compatibility rules
// mean an A+ patient can be served from A+, A-, O+ and O- stock, not just A+.
exports.getAvailability = async (req, res, next) => {
    try {
        const { bloodGroup, hospitalId } = req.query;
        const group = normalize(bloodGroup);
        if (!group) return res.status(400).json({ message: 'A valid bloodGroup query parameter is required' });

        const acceptable = compatibleDonorGroups(group);
        const filter = { bloodGroup: { $in: acceptable } };
        if (hospitalId) filter.hospitalId = hospitalId;

        const rows = await BloodInventory.find(filter)
            .populate('hospitalId', 'hospitalName address city')
            .lean();

        const usableUnits = rows.reduce((n, r) => n + Math.max(0, (r.unitsAvailable || 0) - (r.unitsReserved || 0)), 0);

        res.status(200).json({
            patientBloodGroup: group,
            compatibleWith: acceptable,
            usableUnits,
            breakdown: rows.map(r => ({
                hospital: r.hospitalId,
                bloodGroup: r.bloodGroup,
                unitsAvailable: r.unitsAvailable,
                unitsFree: Math.max(0, (r.unitsAvailable || 0) - (r.unitsReserved || 0))
            }))
        });
    } catch (err) { next(err); }
};

// POST /api/v1/inventory/stock-in — record units received into stock.
exports.stockIn = async (req, res, next) => {
    try {
        const { hospitalId, bloodGroup, units, note, donationId, donorUserId } = req.body;
        if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

        const hospital = await Hospital.findById(hospitalId).lean();
        if (!hospital) return res.status(404).json({ message: 'Hospital not found' });

        const stock = await inventory.recordIn({
            hospitalId, bloodGroup, units: Number(units) || 1,
            donationId, donorUserId, performedBy: actor(req),
            note: note || 'Manual stock-in'
        });
        res.status(201).json({ message: 'Stock updated', stock });
    } catch (err) { next(err); }
};

// POST /api/v1/inventory/stock-out — record units issued or discarded.
exports.stockOut = async (req, res, next) => {
    try {
        const { hospitalId, bloodGroup, units, note, requestId } = req.body;
        if (!hospitalId) return res.status(400).json({ message: 'hospitalId is required' });

        const stock = await inventory.recordOut({
            hospitalId, bloodGroup, units: Number(units) || 1,
            requestId, performedBy: actor(req), note: note || 'Manual stock-out'
        });
        res.status(200).json({ message: 'Stock updated', stock });
    } catch (err) { next(err); }
};

// POST /api/v1/inventory/reserve and /release — hold stock against an approved request.
exports.reserve = async (req, res, next) => {
    try {
        const { hospitalId, bloodGroup, units, requestId, note } = req.body;
        const stock = await inventory.reserve({
            hospitalId, bloodGroup, units: Number(units) || 1, requestId,
            performedBy: actor(req), note
        });
        res.status(200).json({ message: 'Units reserved', stock });
    } catch (err) { next(err); }
};

exports.release = async (req, res, next) => {
    try {
        const { hospitalId, bloodGroup, units, requestId, note } = req.body;
        const stock = await inventory.release({
            hospitalId, bloodGroup, units: Number(units) || 1, requestId,
            performedBy: actor(req), note
        });
        if (!stock) return res.status(200).json({ message: 'Nothing was reserved; no change made' });
        res.status(200).json({ message: 'Reservation released', stock });
    } catch (err) { next(err); }
};

// PUT /api/v1/inventory/:id/threshold — tune the low-stock alert level.
exports.updateThreshold = async (req, res, next) => {
    try {
        const threshold = Number(req.body.reorderThreshold);
        if (!Number.isFinite(threshold) || threshold < 0) {
            return res.status(400).json({ message: 'reorderThreshold must be zero or greater' });
        }
        const stock = await BloodInventory.findByIdAndUpdate(
            req.params.id, { $set: { reorderThreshold: threshold } }, { new: true }
        );
        if (!stock) return res.status(404).json({ message: 'Inventory record not found' });
        res.status(200).json({ message: 'Threshold updated', stock });
    } catch (err) { next(err); }
};

// GET /api/v1/inventory/transactions — the audit ledger.
exports.getTransactions = async (req, res, next) => {
    try {
        const { hospitalId, bloodGroup, type, page = 1, size = 25 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(size, 10) || 25));

        const filter = {};
        if (hospitalId) filter.hospitalId = hospitalId;
        if (bloodGroup && bloodGroup !== 'all') filter.bloodGroup = normalize(bloodGroup);
        if (type && type !== 'all') filter.type = String(type).toUpperCase();

        const [total, transactions] = await Promise.all([
            InventoryTransaction.countDocuments(filter),
            InventoryTransaction.find(filter)
                .populate('hospitalId', 'hospitalName')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * pageSize)
                .limit(pageSize)
                .lean()
        ]);

        res.status(200).json({ count: total, page: pageNum, size: pageSize, transactions });
    } catch (err) { next(err); }
};

// POST /api/v1/inventory/expire — retire stock past its shelf life.
exports.runExpiry = async (req, res, next) => {
    try {
        const expired = await inventory.expireStock();
        res.status(200).json({
            message: `${expired.length} batch(es) expired`,
            expired,
            shelfLifeDays: inventory.SHELF_LIFE_DAYS
        });
    } catch (err) { next(err); }
};

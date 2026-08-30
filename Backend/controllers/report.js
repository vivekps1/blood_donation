// Reporting module.
//
// The Level-1 data flow diagrams show a "Generate Medical Report" process writing to a
// Reports data store and a "View Reports" process reading from it, and
// tb_roles_and_permission carries a view_reports flag. No reporting existed: there was a
// donation-history aggregate endpoint and nothing else, and nothing could be exported.
//
// Every report here accepts ?format=csv to download the same data the screen shows.

const DonationHistory = require('../models/DonationHistory');
const DonationRequest = require('../models/DonationRequest');
const Donor = require('../models/Donor');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const MedicalReport = require('../models/MedicalReport');
const BloodInventory = require('../models/BloodInventory');
const InventoryTransaction = require('../models/InventoryTransaction');
const Notification = require('../models/Notification');
const eligibility = require('../utils/eligibility');
const { sendCsv } = require('../utils/csv');
const { BLOOD_GROUPS, normalize } = require('../utils/bloodCompatibility');

// Shared date-range filter.
const dateRange = (query, field = 'createdAt') => {
    const { dateFrom, dateTo } = query;
    if (!dateFrom && !dateTo) return {};
    const range = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    // An end date with no time means "the whole of that day".
    if (dateTo) {
        const to = new Date(dateTo);
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateTo))) to.setHours(23, 59, 59, 999);
        range.$lte = to;
    }
    return { [field]: range };
};

const wantsCsv = (req) => String(req.query.format || '').toLowerCase() === 'csv';

// ---------------------------------------------------------------------------
// Donation report
// ---------------------------------------------------------------------------

// GET /api/v1/reports/donations
exports.donationsReport = async (req, res, next) => {
    try {
        const { hospitalId, bloodGroup, status } = req.query;
        const filter = { ...dateRange(req.query, 'donationDate') };
        if (hospitalId) filter.hospitalId = String(hospitalId);
        if (status && status !== 'all') filter.status = status;

        const history = await DonationHistory.find(filter).sort({ donationDate: -1 }).lean();

        // Resolve donor, hospital and request names in three queries rather than per row.
        const userIds = [...new Set(history.map(h => h.userId).filter(Boolean))];
        const hospitalIds = [...new Set(history.map(h => h.hospitalId).filter(Boolean))];
        const [users, hospitals] = await Promise.all([
            User.find({ _id: { $in: userIds } }).select('firstName lastName email bloodGroup phoneNumber').lean(),
            Hospital.find({ _id: { $in: hospitalIds } }).select('hospitalName city').lean()
        ]);
        const userMap = new Map(users.map(u => [String(u._id), u]));
        const hospitalMap = new Map(hospitals.map(h => [String(h._id), h]));

        let rows = history.map(h => {
            const user = userMap.get(String(h.userId));
            const hospital = hospitalMap.get(String(h.hospitalId));
            return {
                donationId: h.donationId,
                donationDate: h.donationDate,
                donorName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown',
                donorEmail: user ? user.email : '',
                donorPhone: user ? user.phoneNumber : '',
                bloodGroup: user ? user.bloodGroup : '',
                hospital: hospital ? hospital.hospitalName : '',
                city: hospital ? hospital.city : '',
                units: h.donatedUnits,
                donationType: h.donationType,
                status: h.status,
                requestId: h.requestId,
                remarks: h.remarks
            };
        });

        // Blood group lives on the user, so this filter is applied after the join.
        if (bloodGroup && bloodGroup !== 'all') {
            const group = normalize(bloodGroup);
            rows = rows.filter(r => normalize(r.bloodGroup) === group);
        }

        if (wantsCsv(req)) {
            return sendCsv(res, `donations-report-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
                { key: 'donationId', label: 'Donation ID' }, { key: 'donationDate', label: 'Date' },
                { key: 'donorName', label: 'Donor' }, { key: 'donorEmail', label: 'Email' },
                { key: 'donorPhone', label: 'Phone' }, { key: 'bloodGroup', label: 'Blood Group' },
                { key: 'hospital', label: 'Hospital' }, { key: 'city', label: 'City' },
                { key: 'units', label: 'Units' }, { key: 'donationType', label: 'Type' },
                { key: 'status', label: 'Status' }, { key: 'remarks', label: 'Remarks' }
            ]);
        }

        res.status(200).json({
            rows,
            summary: {
                totalDonations: rows.length,
                totalUnits: rows.reduce((n, r) => n + (r.units || 0), 0),
                uniqueDonors: new Set(rows.map(r => r.donorEmail).filter(Boolean)).size,
                byBloodGroup: BLOOD_GROUPS.reduce((acc, g) => {
                    acc[g] = rows.filter(r => normalize(r.bloodGroup) === g).length;
                    return acc;
                }, {})
            }
        });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Donor register
// ---------------------------------------------------------------------------

// GET /api/v1/reports/donors
exports.donorsReport = async (req, res, next) => {
    try {
        const { bloodGroup, eligibility: eligibilityFilter } = req.query;
        const filter = {};
        if (bloodGroup && bloodGroup !== 'all') filter.bloodGroup = normalize(bloodGroup);

        const donors = await Donor.find(filter).lean();
        const evaluated = await eligibility.evaluateDonors(donors);

        let rows = evaluated.map(({ donor, ...verdict }) => ({
            name: donor.name,
            email: donor.email,
            phoneNumber: donor.phoneNumber,
            bloodGroup: donor.bloodGroup,
            age: donor.age,
            address: donor.address,
            eligibility: verdict.status,
            lastDonationDate: verdict.lastDonationDate,
            nextEligibleDate: verdict.nextEligibleDate,
            daysUntilEligible: verdict.daysUntilEligible,
            reasons: verdict.reasons.join('; ')
        }));

        if (eligibilityFilter && eligibilityFilter !== 'all') {
            rows = rows.filter(r => r.eligibility === eligibilityFilter);
        }

        if (wantsCsv(req)) {
            return sendCsv(res, `donor-register-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
                { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
                { key: 'phoneNumber', label: 'Phone' }, { key: 'bloodGroup', label: 'Blood Group' },
                { key: 'age', label: 'Age' }, { key: 'address', label: 'Address' },
                { key: 'eligibility', label: 'Eligibility' }, { key: 'lastDonationDate', label: 'Last Donation' },
                { key: 'nextEligibleDate', label: 'Next Eligible' }, { key: 'reasons', label: 'Notes' }
            ]);
        }

        res.status(200).json({
            rows,
            summary: {
                totalDonors: rows.length,
                eligible: rows.filter(r => r.eligibility === 'eligible').length,
                ineligible: rows.filter(r => r.eligibility === 'ineligible').length,
                byBloodGroup: BLOOD_GROUPS.reduce((acc, g) => {
                    acc[g] = rows.filter(r => normalize(r.bloodGroup) === g).length;
                    return acc;
                }, {})
            }
        });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Request fulfilment
// ---------------------------------------------------------------------------

// GET /api/v1/reports/requests
exports.requestsReport = async (req, res, next) => {
    try {
        const { status, bloodGroup, hospitalId } = req.query;
        const filter = { ...dateRange(req.query, 'requestDate') };
        if (status && status !== 'all') filter.status = String(status).toUpperCase();
        if (bloodGroup && bloodGroup !== 'all') filter.bloodGroup = normalize(bloodGroup);
        if (hospitalId) filter.hospitalId = String(hospitalId);

        const requests = await DonationRequest.find(filter).sort({ requestDate: -1 }).lean();

        const rows = requests.map(r => {
            const responses = (r.volunteers || []).length;
            const confirmed = (r.volunteers || []).filter(v => v.donationSuccess === true).length;
            return {
                requestDate: r.requestDate,
                patientName: r.patientName,
                bloodGroup: r.bloodGroup,
                unitsRequired: r.bloodUnitsCount,
                unitsFulfilled: r.unitsFulfilled || 0,
                priority: r.priority,
                status: r.status,
                hospital: r.hospitalName,
                requiredDate: r.requiredDate,
                responses,
                confirmedDonations: confirmed,
                donorsNotified: (r.matching && r.matching.notifiedCount) || 0,
                // Time from raising the request to fulfilling it, the headline measure of
                // whether the platform improves emergency response.
                hoursToFulfil: r.fulfilledAt && r.requestDate
                    ? Math.round(((new Date(r.fulfilledAt) - new Date(r.requestDate)) / 3600000) * 10) / 10
                    : null
            };
        });

        if (wantsCsv(req)) {
            return sendCsv(res, `requests-report-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
                { key: 'requestDate', label: 'Raised' }, { key: 'patientName', label: 'Patient' },
                { key: 'bloodGroup', label: 'Blood Group' }, { key: 'unitsRequired', label: 'Units Required' },
                { key: 'unitsFulfilled', label: 'Units Collected' }, { key: 'priority', label: 'Priority' },
                { key: 'status', label: 'Status' }, { key: 'hospital', label: 'Hospital' },
                { key: 'requiredDate', label: 'Needed By' }, { key: 'donorsNotified', label: 'Donors Notified' },
                { key: 'responses', label: 'Responses' }, { key: 'confirmedDonations', label: 'Confirmed' },
                { key: 'hoursToFulfil', label: 'Hours To Fulfil' }
            ]);
        }

        const fulfilled = rows.filter(r => r.status === 'COMPLETED');
        const turnarounds = fulfilled.map(r => r.hoursToFulfil).filter(h => h !== null);

        res.status(200).json({
            rows,
            summary: {
                totalRequests: rows.length,
                completed: fulfilled.length,
                pending: rows.filter(r => r.status === 'PENDING').length,
                inProgress: rows.filter(r => r.status === 'IN_PROGRESS').length,
                rejected: rows.filter(r => r.status === 'REJECTED').length,
                unitsRequired: rows.reduce((n, r) => n + (r.unitsRequired || 0), 0),
                unitsFulfilled: rows.reduce((n, r) => n + (r.unitsFulfilled || 0), 0),
                fulfilmentRate: rows.length ? Math.round((fulfilled.length / rows.length) * 1000) / 10 : 0,
                averageHoursToFulfil: turnarounds.length
                    ? Math.round((turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) * 10) / 10
                    : null
            }
        });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

// GET /api/v1/reports/inventory
exports.inventoryReport = async (req, res, next) => {
    try {
        const { hospitalId } = req.query;
        const filter = hospitalId ? { hospitalId } : {};

        const [stock, movements] = await Promise.all([
            BloodInventory.find(filter).populate('hospitalId', 'hospitalName city').lean(),
            InventoryTransaction.find({ ...filter, ...dateRange(req.query, 'createdAt') })
                .populate('hospitalId', 'hospitalName').sort({ createdAt: -1 }).limit(1000).lean()
        ]);

        const rows = stock.map(s => ({
            hospital: s.hospitalId ? s.hospitalId.hospitalName : '',
            city: s.hospitalId ? s.hospitalId.city : '',
            bloodGroup: s.bloodGroup,
            unitsAvailable: s.unitsAvailable,
            unitsReserved: s.unitsReserved,
            unitsFree: Math.max(0, (s.unitsAvailable || 0) - (s.unitsReserved || 0)),
            reorderThreshold: s.reorderThreshold,
            status: (s.unitsAvailable || 0) <= (s.reorderThreshold || 0) ? 'LOW' : 'OK',
            lastRestockedAt: s.lastRestockedAt
        }));

        if (wantsCsv(req)) {
            return sendCsv(res, `inventory-report-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
                { key: 'hospital', label: 'Hospital' }, { key: 'city', label: 'City' },
                { key: 'bloodGroup', label: 'Blood Group' }, { key: 'unitsAvailable', label: 'Available' },
                { key: 'unitsReserved', label: 'Reserved' }, { key: 'unitsFree', label: 'Free' },
                { key: 'reorderThreshold', label: 'Threshold' }, { key: 'status', label: 'Status' },
                { key: 'lastRestockedAt', label: 'Last Restocked' }
            ]);
        }

        res.status(200).json({
            rows,
            movements: movements.slice(0, 100),
            summary: {
                totalUnits: rows.reduce((n, r) => n + (r.unitsAvailable || 0), 0),
                lowStockLines: rows.filter(r => r.status === 'LOW').length,
                unitsIn: movements.filter(m => m.type === 'IN').reduce((n, m) => n + m.units, 0),
                unitsOut: movements.filter(m => ['OUT', 'EXPIRED'].includes(m.type)).reduce((n, m) => n + m.units, 0),
                unitsExpired: movements.filter(m => m.type === 'EXPIRED').reduce((n, m) => n + m.units, 0)
            }
        });
    } catch (error) { next(error); }
};

// ---------------------------------------------------------------------------
// Executive summary — the numbers the Admin Dashboard leads with.
// ---------------------------------------------------------------------------

// GET /api/v1/reports/summary
exports.summaryReport = async (req, res, next) => {
    try {
        const range = dateRange(req.query, 'createdAt');

        const [donors, users, hospitals, requests, donations, reports, stock, notifications] = await Promise.all([
            Donor.countDocuments(),
            User.countDocuments({ isActive: { $ne: false } }),
            Hospital.countDocuments(),
            DonationRequest.find(dateRange(req.query, 'requestDate')).lean(),
            DonationHistory.find(dateRange(req.query, 'donationDate')).lean(),
            MedicalReport.countDocuments(range),
            BloodInventory.find().lean(),
            Notification.countDocuments(dateRange(req.query, 'sentAt'))
        ]);

        const completed = requests.filter(r => String(r.status).toUpperCase() === 'COMPLETED');

        res.status(200).json({
            generatedAt: new Date(),
            period: { from: req.query.dateFrom || null, to: req.query.dateTo || null },
            people: { activeUsers: users, registeredDonors: donors, hospitals },
            requests: {
                total: requests.length,
                completed: completed.length,
                pending: requests.filter(r => String(r.status).toUpperCase() === 'PENDING').length,
                fulfilmentRate: requests.length ? Math.round((completed.length / requests.length) * 1000) / 10 : 0,
                unitsRequested: requests.reduce((n, r) => n + (r.bloodUnitsCount || 0), 0)
            },
            donations: {
                total: donations.length,
                successful: donations.filter(d => eligibility.SUCCESSFUL_STATUSES.includes(d.status)).length,
                unitsCollected: donations.reduce((n, d) => n + (d.donatedUnits || 0), 0)
            },
            inventory: {
                totalUnits: stock.reduce((n, s) => n + (s.unitsAvailable || 0), 0),
                lowStockLines: stock.filter(s => (s.unitsAvailable || 0) <= (s.reorderThreshold || 0)).length,
                byBloodGroup: BLOOD_GROUPS.reduce((acc, g) => {
                    acc[g] = stock.filter(s => s.bloodGroup === g).reduce((n, s) => n + (s.unitsAvailable || 0), 0);
                    return acc;
                }, {})
            },
            medicalReports: reports,
            notificationsSent: notifications
        });
    } catch (error) { next(error); }
};

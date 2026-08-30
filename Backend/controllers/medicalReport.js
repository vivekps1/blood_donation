// Medical Report module.
//
// Implements tb_medical_report (synopsis section 8) and the "Generate Medical Report" /
// "View Medical Report" processes that appear in both Level-1 data flow diagrams. The
// model existed but had no controller, no routes and no writer: donation proof was kept
// as a bare file path on the donation request, and the clinical fields the report
// specifies — haemoglobin, blood pressure, sugar level, fitness to donate — were unused.
//
// A report's `isEligible` flag is authoritative for donor health status: filing a report
// that marks a donor unfit immediately blocks them from matching, and filing a fit report
// clears that block.

const path = require('path');
const MedicalReport = require('../models/MedicalReport');
const Donor = require('../models/Donor');
const User = require('../models/User');
const Hospital = require('../models/Hospital');

const actor = (req) => (req.user && req.user.userId ? String(req.user.userId) : undefined);

// Keep the donor's health flag in step with the most recent report filed for them.
const syncDonorEligibility = async (userId, isEligible) => {
    try {
        const donor = await Donor.findOne({ userId });
        if (!donor) return;
        donor.eligibility = isEligible ? 'eligible' : 'ineligible';
        donor.eligibilityUpdatedDate = new Date();
        await donor.save();
    } catch (err) {
        console.warn('[medicalReport] failed to sync donor eligibility:', err.message || err);
    }
};

// POST /api/v1/medical-reports  (multipart or JSON; `file` is optional)
exports.createReport = async (req, res, next) => {
    try {
        const { userId, hospitalId, requestId, donationId, reportType, hemoglobinLevel,
                bloodPressure, sugarLevel, testResult, medicalCondition, doctorName, reportDate } = req.body;

        if (!userId) return res.status(400).json({ message: 'userId is required' });

        const user = await User.findById(userId).lean();
        if (!user) return res.status(404).json({ message: 'No user found for the supplied userId' });

        // Checkboxes arrive as strings over multipart, so coerce explicitly.
        const isEligible = req.body.isEligible === true || req.body.isEligible === 'true';

        const report = await MedicalReport.create({
            reportId: `MR-${Date.now()}-${String(userId).slice(-6)}`,
            userId: String(userId),
            hospitalId: hospitalId ? String(hospitalId) : undefined,
            requestId: requestId ? String(requestId) : undefined,
            donationId: donationId ? String(donationId) : undefined,
            reportDate: reportDate ? new Date(reportDate) : new Date(),
            reportType: reportType || 'Screening',
            filePath: req.file ? path.join('uploads/medical-reports', req.file.filename) : undefined,
            hemoglobinLevel, bloodPressure, sugarLevel,
            isEligible, testResult, medicalCondition, doctorName,
            createdBy: actor(req)
        });

        await syncDonorEligibility(String(userId), isEligible);

        res.status(201).json({ message: 'Medical report created', report });
    } catch (err) { next(err); }
};

// GET /api/v1/medical-reports
exports.getReports = async (req, res, next) => {
    try {
        const { userId, hospitalId, requestId, reportType, isEligible, dateFrom, dateTo, page = 1, size = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(size, 10) || 20));

        const filter = {};
        if (userId) filter.userId = String(userId);
        if (hospitalId) filter.hospitalId = String(hospitalId);
        if (requestId) filter.requestId = String(requestId);
        if (reportType && reportType !== 'all') filter.reportType = reportType;
        if (typeof isEligible !== 'undefined' && isEligible !== 'all') {
            filter.isEligible = isEligible === 'true' || isEligible === '1';
        }
        if (dateFrom || dateTo) {
            filter.reportDate = {};
            if (dateFrom) filter.reportDate.$gte = new Date(dateFrom);
            if (dateTo) filter.reportDate.$lte = new Date(dateTo);
        }

        // Donors may only ever read their own reports, whatever they ask for.
        if (!req.role || req.role.viewMedicalReports !== true || req.role.userRole === 'donor') {
            filter.userId = String(req.user.userId);
        }

        const [total, reports] = await Promise.all([
            MedicalReport.countDocuments(filter),
            MedicalReport.find(filter).sort({ reportDate: -1 })
                .skip((pageNum - 1) * pageSize).limit(pageSize).lean()
        ]);

        // Attach donor and hospital names so the table does not need N follow-up calls.
        const userIds = [...new Set(reports.map(r => r.userId).filter(Boolean))];
        const hospitalIds = [...new Set(reports.map(r => r.hospitalId).filter(Boolean))];
        const [users, hospitals] = await Promise.all([
            User.find({ _id: { $in: userIds } }).select('firstName lastName email bloodGroup').lean(),
            Hospital.find({ _id: { $in: hospitalIds } }).select('hospitalName').lean()
        ]);
        const userMap = new Map(users.map(u => [String(u._id), u]));
        const hospitalMap = new Map(hospitals.map(h => [String(h._id), h]));

        res.status(200).json({
            count: total, page: pageNum, size: pageSize,
            reports: reports.map(r => ({
                ...r,
                donor: userMap.get(String(r.userId)) || null,
                hospital: hospitalMap.get(String(r.hospitalId)) || null
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/v1/medical-reports/:id
exports.getReportById = async (req, res, next) => {
    try {
        const report = await MedicalReport.findById(req.params.id).lean();
        if (!report) return res.status(404).json({ message: 'Medical report not found' });

        const canViewAny = req.role && req.role.viewMedicalReports === true && req.role.userRole !== 'donor';
        if (!canViewAny && String(report.userId) !== String(req.user.userId)) {
            return res.status(403).json({ message: 'You may only view your own medical reports' });
        }
        res.status(200).json(report);
    } catch (err) { next(err); }
};

// PUT /api/v1/medical-reports/:id
exports.updateReport = async (req, res, next) => {
    try {
        const updates = { ...req.body };
        // Identity fields are set at creation and must not be rewritten afterwards.
        ['userId', 'reportId', 'createdBy'].forEach(f => delete updates[f]);

        if (typeof updates.isEligible !== 'undefined') {
            updates.isEligible = updates.isEligible === true || updates.isEligible === 'true';
        }
        if (req.file) updates.filePath = path.join('uploads/medical-reports', req.file.filename);

        const report = await MedicalReport.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!report) return res.status(404).json({ message: 'Medical report not found' });

        if (typeof updates.isEligible !== 'undefined') {
            await syncDonorEligibility(String(report.userId), report.isEligible);
        }
        res.status(200).json({ message: 'Medical report updated', report });
    } catch (err) { next(err); }
};

// DELETE /api/v1/medical-reports/:id
exports.deleteReport = async (req, res, next) => {
    try {
        const report = await MedicalReport.findByIdAndDelete(req.params.id);
        if (!report) return res.status(404).json({ message: 'Medical report not found' });
        res.status(200).json({ message: 'Medical report deleted', report });
    } catch (err) { next(err); }
};

// GET /api/v1/medical-reports/user/:userId/latest
// The screening a donor or admin most likely wants: the newest report on file.
exports.getLatestForUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const canViewAny = req.role && req.role.viewMedicalReports === true && req.role.userRole !== 'donor';
        if (!canViewAny && String(userId) !== String(req.user.userId)) {
            return res.status(403).json({ message: 'You may only view your own medical reports' });
        }
        const report = await MedicalReport.findOne({ userId: String(userId) }).sort({ reportDate: -1 }).lean();
        if (!report) return res.status(404).json({ message: 'No medical report on file for this user' });
        res.status(200).json(report);
    } catch (err) { next(err); }
};

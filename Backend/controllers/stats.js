// System-wide statistics for the Admin Dashboard.

const Donor = require("../models/Donor");
const Hospital = require("../models/Hospital");
const DonationRequest = require("../models/DonationRequest");
const DonationHistory = require("../models/DonationHistory");
const BloodInventory = require("../models/BloodInventory");
const Notification = require("../models/Notification");
const User = require("../models/User");
const eligibility = require("../utils/eligibility");

const getSystemStats = async (req, res, next) => {
  try {
    const [
      totalDonors, totalHospitals, totalRequests, totalUsers,
      unitsAgg, statusCounts, donationAgg, stock, unreadForMe
    ] = await Promise.all([
      Donor.countDocuments(),
      Hospital.countDocuments(),
      DonationRequest.countDocuments(),
      User.countDocuments({ isActive: { $ne: false } }),

      DonationRequest.aggregate([
        { $group: { _id: null, totalUnitsRequested: { $sum: "$bloodUnitsCount" }, totalUnitsFulfilled: { $sum: "$unitsFulfilled" } } }
      ]),
      DonationRequest.aggregate([
        { $group: { _id: { $toUpper: "$status" }, count: { $sum: 1 } } }
      ]),
      // Successful donations are counted from donation history, which is the record of
      // what actually happened. The previous implementation counted *requests* with a
      // completed status and reported that as "successful donations", which conflated a
      // fulfilled request with the donations that fulfilled it.
      DonationHistory.aggregate([
        { $match: { status: { $in: eligibility.SUCCESSFUL_STATUSES } } },
        { $group: { _id: null, count: { $sum: 1 }, units: { $sum: "$donatedUnits" } } }
      ]),
      BloodInventory.find().lean(),
      req.user ? Notification.countDocuments({ userId: String(req.user.userId), isRead: false }) : 0
    ]);

    const units = unitsAgg[0] || {};
    const donations = donationAgg[0] || {};
    const byStatus = statusCounts.reduce((acc, s) => { acc[s._id || 'UNKNOWN'] = s.count; return acc; }, {});

    return res.status(200).json({
      totalUsers,
      totalDonors,
      totalHospitals,
      totalRequests,
      totalUnitsRequested: units.totalUnitsRequested || 0,
      totalUnitsFulfilled: units.totalUnitsFulfilled || 0,
      totalSuccessfulDonations: donations.count || 0,
      totalUnitsCollected: donations.units || 0,
      requestsByStatus: byStatus,
      pendingApprovals: byStatus.PENDING || 0,
      inventory: {
        totalUnits: stock.reduce((n, s) => n + (s.unitsAvailable || 0), 0),
        lowStockLines: stock.filter(s => (s.unitsAvailable || 0) <= (s.reorderThreshold || 0)).length
      },
      unreadNotifications: unreadForMe
    });
  } catch (error) { next(error); }
};

module.exports = { getSystemStats };

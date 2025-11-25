const Donor = require("../models/Donor");
const Hospital = require("../models/Hospital");
const DonationRequest = require("../models/DonationRequest");

// Return simple system-wide statistics (counts and sums).
const getSystemStats = async (req, res) => {
  try {
    const totalDonors = await Donor.countDocuments();
    const totalHospitals = await Hospital.countDocuments();
    const totalRequests = await DonationRequest.countDocuments();

    // Sum of requested blood units across all donation requests
    const unitsAgg = await DonationRequest.aggregate([
      { $match: { bloodUnitsCount: { $exists: true } } },
      { $group: { _id: null, totalUnitsRequested: { $sum: "$bloodUnitsCount" } } }
    ]);
    const totalUnitsRequested = (unitsAgg && unitsAgg[0] && unitsAgg[0].totalUnitsRequested) || 0;

    // Total successful donations — count history entries with status 'Completed' (case-insensitive)
    const totalSuccessfulDonations = await DonationRequest.countDocuments({ status: { $regex: /^completed$/i } });

    return res.status(200).json({
      totalDonors,
      totalHospitals,
      totalRequests,
      totalUnitsRequested,
      totalSuccessfulDonations
    });
  } catch (error) {
    console.error('Failed to compute system stats', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

module.exports = { getSystemStats };

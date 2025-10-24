const DonationHistory = require('../models/DonationHistory');
const Hospital = require('../models/Hospital');
const DonationRequest = require('../models/DonationRequest');
const MedicalReport = require('../models/MedicalReport');
const User = require('../models/User');

// GET /api/v1/donation/history/aggregate
// Optional query params: userId, hospitalId, requestId, reportId, dateFrom, dateTo, status, donationType
exports.getDonationHistoryAggregate = async (req, res) => {
  try {
    const { userId, hospitalId, requestId, reportId, dateFrom, dateTo, status, donationType } = req.query;

    const match = {};
    if (userId) match.userId = userId;
    if (hospitalId) match.hospitalId = hospitalId;
    if (requestId) match.requestId = requestId;
    if (reportId) match.reportId = reportId;
    if (status) match.status = status;
    if (donationType) match.donationType = donationType;
    if (dateFrom || dateTo) {
      match.donationDate = {};
      if (dateFrom) match.donationDate.$gte = new Date(dateFrom);
      if (dateTo) match.donationDate.$lte = new Date(dateTo);
    }

    const pipeline = [
      { $match: match },
      // Join User (userId stored as string of ObjectId in DonationHistory)
      { $lookup: {
          from: 'users',
          let: { uid: '$userId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$uid' }] } } },
            { $project: { firstName:1, lastName:1, userName:1, email:1, phoneNumber:1, bloodGroup:1 } }
          ],
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
           { $lookup: {
          from: 'hospitals',
          let: { uid: '$hospitalId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$uid' }] } } },
          ],
          as: 'hospital'
        }
      },
      { $unwind: { path: '$hospital', preserveNullAndEmptyArrays: true } },
    { $lookup: {
          from: 'donationrequests',
          let: { rid: '$requestId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$rid', null] },
                    { $ne: ['$$rid', ''] },
                    // Ensure string looks like a 24-char hex ObjectId before converting
                    { $regexMatch: { input: '$$rid', regex: /^[a-fA-F0-9]{24}$/ } },
                    {
                      $eq: [
                        '$_id',
                        { $convert: { input: '$$rid', to: 'objectId', onError: null, onNull: null } }
                      ]
                    }
                  ]
                }
              }
            }          ],
          as: 'request'
        }
      },
      { $unwind: { path: '$request', preserveNullAndEmptyArrays: true } },
          { $lookup: {
          from: 'medicalreports',
          let: { rid: '$reportId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$$rid', null] },
                    { $ne: ['$$rid', ''] },
                    // Ensure string looks like a 24-char hex ObjectId before converting
                    { $regexMatch: { input: '$$rid', regex: /^[a-fA-F0-9]{24}$/ } },
                    {
                      $eq: [
                        '$_id',
                        { $convert: { input: '$$rid', to: 'objectId', onError: null, onNull: null } }
                      ]
                    }
                  ]
                }
              }
            },
          ],
          as: 'report'
        }
      },
      { $unwind: { path: '$report', preserveNullAndEmptyArrays: true } },

      // Shape fields
      { $project: {
          donationId: 1,
          donationDate: 1,
          donatedUnits: 1,
          donationType: 1,
          status: 1,
          remarks: 1,
          user: {
            _id: '$user._id',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            userName: '$user.userName',
            email: '$user.email',
            phoneNumber: '$user.phoneNumber',
            bloodGroup: '$user.bloodGroup'
          },
          hospital: {
            hospitalId: '$hospital._id',
            hospitalName: '$hospital.hospitalName',
            city: '$hospital.city',
            state: '$hospital.state',
            isVerified: '$hospital.isVerified'
          },
          request: {
            requestId: '$request._id',
            bloodGroup: '$request.bloodGroup',
            bloodUnitsCount: '$request.bloodUnitsCount',
            priority: '$request.priority',
            status: '$request.status',
            location: '$request.location'
          },
          report: {
            reportId: '$report._id',
            reportDate: '$report.reportDate',
            hemoglobinLevel: '$report.hemoglobinLevel',
            bloodPressure: '$report.bloodPressure',
            sugarLevel: '$report.sugarLevel',
            isEligible: '$report.isEligible',
            medicalCondition: '$report.medicalCondition'
          }
      }},
      // Optionally add summary grouping
    ];

    // Summary stage for totals (units per donationType & status)
    const summaryPipeline = [
      ...pipeline,
      { $group: {
          _id: null,
          totalDonations: { $sum: 1 },
          totalUnits: { $sum: { $ifNull: ['$donatedUnits', 0] } },
          byType: { $push: { donationType: '$donationType', units: '$donatedUnits' } },
          byStatus: { $push: { status: '$status', donationId: '$donationId' } }
        }
      }
    ];

    const [records, summaryArr] = await Promise.all([
      DonationHistory.aggregate(pipeline),
      DonationHistory.aggregate(summaryPipeline)
    ]);

    const summary = summaryArr[0] || { totalDonations: 0, totalUnits: 0, byType: [], byStatus: [] };

    res.json({ records, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

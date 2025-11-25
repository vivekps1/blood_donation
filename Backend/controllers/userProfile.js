const User = require('../models/User');
const Donor = require('../models/Donor');

// Get user profile by userId
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    // find by _id (userId param is the ObjectId)
    const profile = await User.findById(userId);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create user profile
exports.createUserProfile = async (req, res) => {
  try {
    const profile = new User(req.body);
    await profile.save();
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    // If attempting to change email or phoneNumber, validate duplicates
    if (req.body.email || req.body.phoneNumber) {
      const dupQuery = [];
      if (req.body.email) dupQuery.push({ email: req.body.email });
      if (req.body.phoneNumber) dupQuery.push({ phoneNumber: req.body.phoneNumber });
      if (dupQuery.length) {
        const conflict = await User.findOne({ $or: dupQuery, _id: { $ne: userId } }).lean();
        if (conflict) {
          const fields = {};
          if (req.body.email && conflict.email === req.body.email) fields.email = true;
          if (req.body.phoneNumber && conflict.phoneNumber === req.body.phoneNumber) fields.phoneNumber = true;
          return res.status(409).json({ code: 'DUPLICATE', msg: 'Email or phone number already exists', fields });
        }
      }
    }
    // Update user document
    const userUpdate = { ...req.body };
    // Normalize potential fields for user schema
    if (userUpdate.name && (!userUpdate.firstName && !userUpdate.lastName)) {
      const parts = String(userUpdate.name).trim().split(' ');
      userUpdate.firstName = parts[0];
      userUpdate.lastName = parts.slice(1).join(' ') || '';
    }
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      userUpdate,
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ message: 'Profile not found' });

    // Sync donor record if exists
    const donor = await Donor.findOne({ userId });
    if (donor) {
      const donorUpdate = {};
      if (userUpdate.firstName || userUpdate.lastName) {
        donorUpdate.name = `${updatedUser.firstName} ${updatedUser.lastName}`.trim();
      }
      ['email','address','phoneNumber','bloodGroup','height','weight','dateofBirth'].forEach(f => {
        if (userUpdate[f] !== undefined) donorUpdate[f] = userUpdate[f];
      });
      // Recompute age if DOB changed
      if (userUpdate.dateofBirth) {
        const dob = new Date(userUpdate.dateofBirth);
        const diff = Date.now() - dob.getTime();
        donorUpdate.age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
      }
      await Donor.findByIdAndUpdate(donor._id, { $set: donorUpdate });
    }

    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

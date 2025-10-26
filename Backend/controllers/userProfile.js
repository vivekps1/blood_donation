const User = require('../models/User');

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
    const profile = await User.findOneAndUpdate(
      { _id: userId },
      req.body,
      { new: true }
    );
    if (!profile) return res.status(404).json({ message: 'Profile not found' });
    res.json(profile);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const mongoose = require('mongoose');
const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const path = require('path');
const fs = require('fs');
const Donor = require('../models/Donor');

// Get user profile by userId
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    // normalize the id to ObjectId if possible so we can query the profile
    // Build a list of possible queries to support both old numeric IDs and ObjectId strings
    const queries = [];
    if (mongoose.Types.ObjectId.isValid(userId)) queries.push({ userId: new mongoose.Types.ObjectId(userId) });
    const maybeNumber = Number(userId);
    if (!Number.isNaN(maybeNumber)) queries.push({ userId: maybeNumber });
    // fallback to raw userId if no canonical matches can be formed
    if (queries.length === 0) queries.push({ userId: userId });
    // first attempt to find a dedicated UserProfile entry
    let profile = await UserProfile.findOne({ $or: queries }).lean();
    if (profile) return res.json(profile);
    // fall back to returning the User doc as legacy behavior
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    return res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create user profile
exports.createUserProfile = async (req, res) => {
  try {
    // normalize userId if it's a valid ObjectId string
    const payload = { ...req.body };
    if (payload.userId && mongoose.Types.ObjectId.isValid(payload.userId)) payload.userId = new mongoose.Types.ObjectId(payload.userId);
    const profile = new UserProfile(payload);
    await profile.save();
    // also sync certain fields to the User document
    if (profile.userId) {
      const update = { address: profile.address, locationGeo: profile.locationGeo };
      if (profile.locationName) update.locationName = profile.locationName;
      await User.findByIdAndUpdate(profile.userId, update, { new: true });
    }
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
        // sync address / location fields to the main User document for known consumers
    const updateForUser = {};
    if (req.body.address) updateForUser.address = req.body.address;
    if (req.body.locationGeo) updateForUser.locationGeo = req.body.locationGeo;
    // keep a simple locationName on the main user as well
    if (req.body.locationName) updateForUser.locationName = req.body.locationName;
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

// Upload profile photo and update user's `photo` field
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // verify caller is allowed to upload for this user
    try {
      if (req.user) {
        const callerId = String(req.user.userId || req.user.id);
        const targetId = String(userId);
        if (req.user.roleId !== 0 && callerId !== targetId) {
          return res.status(403).json({ message: 'Forbidden: cannot upload photo for another user' });
        }
      }
    } catch (e) {
      // ignore verification errors; continue and rely on other checks
    }
    console.log('Uploading profile photo for userId:', userId);
    console.log('Received file:', req.file && { originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
    // Save relative path (accessible via /uploads)
    // normalize to use forward slashes for URLs
    const relativePath = path.posix.join('profile-pics', req.file.filename);
    // Return an absolute URL for the photo so clients on different hosts can access it correctly
    const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${relativePath}`;
    // normalize userId for queries
    const queryId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const user = await User.findByIdAndUpdate(queryId, { photo: photoUrl }, { new: true });
    console.log('Photo URL set on user:', { userId, photoUrl, exists: !!user });
    if (!user) return res.status(404).json({ message: 'User not found' });
    // also upsert profile photo on UserProfile (if you keep photos there)
    try {
      const profileUpdate = { photo: photoUrl };
      // for backwards compatibility, try both object id and numeric userId
      const where = mongoose.Types.ObjectId.isValid(userId) ? { userId: new mongoose.Types.ObjectId(userId) } : { userId };
      const profile = await UserProfile.findOneAndUpdate(where, profileUpdate, { new: true, upsert: true });
      console.log('UserProfile photo updated', { profileId: profile ? profile._id : null });
    } catch (e) {
      console.warn('Failed to update UserProfile photo:', e?.message || e);
    }
    res.json({ photo: photoUrl, user });
  } catch (err) {
    console.error('Error uploading profile photo:', err);
    res.status(500).json({ message: err.message });
  }
};

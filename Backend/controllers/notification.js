const Notification = require('../models/Notification');
const User = require('../models/User');
const Roles = require('../models/Roles');
const DonationHistory = require('../models/DonationHistory');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// Create a new notification (admin)
const createNotification = async (req, res) => {
  try {
    // Allow body to contain relevant fields; set sentAt if not provided
    const payload = {
      ...req.body,
      channel: req.body.channel || 'app',
      sentAt: req.body.sentAt ? new Date(req.body.sentAt) : new Date()
    };

    // Determine recipients based on payload.userId which may be a selector string
    const audience = payload.userId || 'all';
    let targetUsers = [];

    if (audience === 'all') {
      targetUsers = await User.find({});
    } else if (audience === 'donors') {
      // Find roleId for donor
      const roleDoc = await Roles.findOne({ userRole: 'donor' });
      if (roleDoc) {
        targetUsers = await User.find({ roleId: roleDoc.roleId });
      } else {
        targetUsers = [];
      }
    } else if (audience === 'eligible') {
      // Find all donor users, then compute eligibility using DonationHistory (>=30 days since last successful donation or no success = eligible)
      const roleDoc = await Roles.findOne({ userRole: 'donor' });
      let donorUsers = [];
      if (roleDoc) donorUsers = await User.find({ roleId: roleDoc.roleId });

      // Aggregate latest successful donation date per user
      const latestSuccess = await DonationHistory.aggregate([
        { $match: { status: 'Success', donationDate: { $exists: true } } },
        { $sort: { donationDate: -1 } },
        { $group: { _id: '$userId', latestDate: { $first: '$donationDate' } } }
      ]);

      const latestMap = new Map();
      latestSuccess.forEach(item => latestMap.set(String(item._id), new Date(item.latestDate)));

      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      targetUsers = donorUsers.filter(u => {
        const latestDate = latestMap.get(String(u._id));
        if (!latestDate) return true; // no successful donation => eligible
        const diffTime = nowIST.getTime() - new Date(latestDate).getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);
        return diffDays >= 30;
      });
    } else if (typeof audience === 'string') {
      // If audience looks like a user id, try to fetch single user
      const maybeUser = await User.findById(audience);
      if (maybeUser) targetUsers = [maybeUser];
    }

    // If no recipients found, still return saved base notification
    if (!targetUsers || targetUsers.length === 0) {
      res.status(201).json({ message: 'No recipients found for audience', createdCount: 0 });
      return;
    }

    // Prepare transporter for email if configured
    let transporter = null;
    try {
      // Control TLS certificate validation via env var. Default to false (do not reject) to match test script behavior.
      const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED === 'true';
      const transportOptions = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        tls: { rejectUnauthorized: rejectUnauthorized }
      };

      transporter = nodemailer.createTransport(transportOptions);

      // Verify transporter early and log any problems (non-fatal)
      transporter.verify().then(() => {
        console.log('SMTP transporter verified');
      }).catch(err => {
        console.warn('SMTP transporter verification failed:', err && err.message ? err.message : err);
      });
    } catch (err) {
      console.warn('Email transporter setup failed:', err && err.message ? err.message : err);
    }

    // Create notifications and send messages in parallel (map to promises)
    const sendPromises = targetUsers.map(async (user) => {
      try {
        const perPayload = { ...payload, userId: String(user._id), sentAt: new Date() };
        const note = new Notification(perPayload);
        await note.save();

        const channels = Array.isArray(perPayload.channel) ? perPayload.channel : [perPayload.channel];
        if ((channels.includes('email') || channels.includes('both')) && user.email && transporter) {
          try {
            await transporter.sendMail({
              from: process.env.MAIL_FROM || 'no-reply@example.com',
              to: user.email,
              subject: perPayload.title || 'Notification',
              text: perPayload.message || ''
            }).then(() => {console.log('Email sent to', user.email);}).catch((err) => {console.error('Error sending email to', user.email, err);});
          } catch (err) {
            console.error('Error sending email to', user.email, err);
          }
        }

        if ((channels.includes('sms') || channels.includes('both')) && user.phoneNumber) {
          try {
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
              const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
              await twilio.messages.create({ body: perPayload.message || '', from: process.env.TWILIO_PHONE_NUMBER, to: user.phoneNumber });
            } else {
              console.log(`Simulated SMS to ${user.phoneNumber}: ${perPayload.message}`);
            }
          } catch (err) {
            console.error('Error sending SMS to', user.phoneNumber, err);
          }
        }

        return { user: user._id, ok: true,targetEmail: user.email };
      } catch (err) {
        return { user: user._id, ok: false, error: err.message || err,targetEmail: user.email};
      }
    });

    const results = await Promise.allSettled(sendPromises);
    const createdCount = results.filter(r => r.status === 'fulfilled').length;

    res.status(201).json({ message: 'Notifications dispatched', createdCount, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get notifications with optional filters: userId, isRead, type, pagination
const getNotifications = async (req, res) => {
  try {
    const { userId, isRead, type, page = 1, size = 20 } = req.query;
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);

    const filter = {};
    if (userId) filter.userId = userId;
    if (typeof isRead !== 'undefined') filter.isRead = (isRead === 'true' || isRead === '1');
    if (type) filter.notificationType = type;

    const total = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter)
      .sort({ sentAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize);

    res.status(200).json({ count: total, page: pageNum, size: pageSize, notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark a single notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Notification not found' });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all notifications for a user as read
const markAllAsReadForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
    res.status(200).json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notification.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Notification not found' });
    res.status(200).json({ message: 'Notification deleted', deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsReadForUser,
  deleteNotification,
};

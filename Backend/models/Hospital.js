const mongoose = require("mongoose");

// Updated: hospitalId switched from Number to String.
// Also fixed typos (required) and changed isVerified to Boolean for semantic correctness.
// NOTE: If existing documents store hospitalId as a Number, run a migration to cast them to String.
// e.g. db.hospitals.find({ hospitalId: { $type: 'int' } }).forEach(d => db.hospitals.updateOne({ _id: d._id }, { $set: { hospitalId: d.hospitalId.toString() } }));

const HospitalSchema = new mongoose.Schema({
  hospitalId: { type: String, required: false, index: true },
  hospitalName: { type: String, required: true },
  regNo: { type: Number, required: true },
  contactName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  // Optional human-friendly location tag (e.g. campus, zone, branch name)
  location: { type: String, required: false },
  // GeoJSON point for precise location (stored as [lng, lat])
  locationGeo: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      default: [0, 0]
    }
  },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

// Safeguard: ensure hospitalId stored as string if provided numerically.
HospitalSchema.pre('save', function(next) {
  if (this.hospitalId != null && typeof this.hospitalId !== 'string') {
    this.hospitalId = String(this.hospitalId);
  }
  next();
});

module.exports = mongoose.model("Hospital", HospitalSchema);

// Create 2dsphere index for geospatial queries
HospitalSchema.index({ locationGeo: '2dsphere' });
const mongoose = require("mongoose");

// Real-time blood stock, held per hospital and per blood group.
//
// The synopsis names "real-time blood inventory" in the Introduction, the Objectives and
// the Admin Dashboard module, but no inventory store existed. This collection holds the
// current balance; every change to it is also written to InventoryTransaction so the
// balance can always be reconciled against its ledger.

const BloodInventorySchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    bloodGroup: { type: String, required: true },

    // Units on the shelf and not promised to anyone.
    unitsAvailable: { type: Number, default: 0, min: 0 },
    // Units held against an approved donation request but not yet issued.
    unitsReserved: { type: Number, default: 0, min: 0 },

    // Administrators are alerted when unitsAvailable drops below this.
    reorderThreshold: { type: Number, default: 5, min: 0 },

    lastRestockedAt: { type: Date },
    lastIssuedAt: { type: Date }
}, { timestamps: true });

// One stock row per hospital per blood group.
BloodInventorySchema.index({ hospitalId: 1, bloodGroup: 1 }, { unique: true });

// Convenience for the dashboard: what is genuinely free to promise.
BloodInventorySchema.virtual('unitsFree').get(function () {
    return Math.max(0, (this.unitsAvailable || 0) - (this.unitsReserved || 0));
});
BloodInventorySchema.set('toJSON', { virtuals: true });
BloodInventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("BloodInventory", BloodInventorySchema);

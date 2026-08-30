const mongoose = require("mongoose");

// Append-only ledger of every stock movement.
//
// Inventory levels alone cannot answer "who issued those four units and when", which the
// synopsis requires for traceability of medical records (section 5, "Improved Data
// Integrity"). Each row records the movement and the balance it produced.

const TRANSACTION_TYPES = ['IN', 'OUT', 'RESERVE', 'RELEASE', 'EXPIRED', 'ADJUST'];

const InventoryTransactionSchema = new mongoose.Schema({
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    bloodGroup: { type: String, required: true, index: true },

    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    // Always positive; `type` carries the direction.
    units: { type: Number, required: true, min: 0 },

    // Balance of unitsAvailable immediately after this movement was applied.
    balanceAfter: { type: Number },

    // Provenance: a donation that added stock, or a request that consumed it.
    donationId: { type: String },
    requestId: { type: String },
    donorUserId: { type: String },

    // Whole blood keeps for roughly 35-42 days; set on IN movements so stock can expire.
    expiryDate: { type: Date, index: true },
    expired: { type: Boolean, default: false },

    performedBy: { type: String },
    note: { type: String }
}, { timestamps: true });

InventoryTransactionSchema.index({ hospitalId: 1, bloodGroup: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryTransaction", InventoryTransactionSchema);
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;

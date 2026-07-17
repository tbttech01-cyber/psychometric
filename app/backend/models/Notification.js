const mongoose = require('mongoose');

// Admin-facing notifications for real workflow events (an assessment result is
// saved, a retest request is created). Stores only small display metadata plus a
// reference to the source entity — never a copy of the full result/request. The
// admin app resolves entityType + entityId to the existing Results / Retest
// Requests detail routes.
const notificationSchema = new mongoose.Schema(
  {
    // Optional target. null = a shared admin feed (this platform is effectively
    // single-admin; kept nullable so notifications can later be addressed to a
    // specific admin without a schema change).
    recipientAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null, index: true },

    type: {
      type: String,
      enum: ['ASSESSMENT_SUBMITTED', 'RETEST_REQUEST_CREATED'],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },

    entityType: { type: String, enum: ['RESULT', 'RETEST_REQUEST'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Small, display-only snapshot — enough to render the item without a join,
    // deliberately NOT the full result/request document.
    metadata: {
      userName: { type: String },
      userEmail: { type: String },
      score: { type: Number },
      accessCode: { type: String },
      recommendedBusiness: { type: String },
      level: { type: String },
      status: { type: String },
      attemptNumber: { type: Number },
    },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true } // createdAt / updatedAt
);

// Idempotency: exactly one notification per source event. A retried submit or a
// duplicate request-create can't produce a second notification.
notificationSchema.index({ type: 1, entityId: 1 }, { unique: true });

// Feed queries: newest first, and unread-first counting.
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

const mongoose = require('mongoose');
const { applyModelEncryption } = require('../utils/modelEncryption');
const { normalizeEmail, normalizePhone } = require('../utils/fieldCrypto');

const ApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    emailHash: { type: String, index: true, sparse: true, select: false },
    phone: { type: String, required: true, trim: true },
    phoneHash: { type: String, index: true, sparse: true, select: false },
    year: { type: Number, min: 1, max: 6 },
    branch: { type: String, default: '', trim: true },
    college: { type: String, default: '', trim: true },
    interests: [{ type: String, trim: true }],
    motivation: { type: String, default: '' },
    experience: { type: String, default: '' },
    availability: { type: String, default: '' },
    socials: {
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
      portfolio: { type: String, default: '' },
    },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    recruitmentDrive: { type: mongoose.Schema.Types.ObjectId, ref: 'RecruitmentDrive', default: null },
    dynamicResponses: { type: mongoose.Schema.Types.Mixed, default: {} },
    interview: {
      date: { type: Date, default: null },
      link: { type: String, default: '' },
      location: { type: String, default: '' },
      marks: { type: Number, default: null, min: 0, max: 100 }
    },
    status: {
      type: String,
      enum: ['New', 'InReview', 'Interview', 'Accepted', 'Selected', 'Rejected'],
      default: 'New',
    },
    stage: { type: String, default: 'Round 1', maxlength: 40 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: [
      {
        text: { type: String, required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    history: [
      {
        status: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
    inviteCode: { type: String, default: '' },
    inviteSentAt: { type: Date, default: null },
    inviteSentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

ApplicationSchema.index({ status: 1, createdAt: -1 });
ApplicationSchema.index({ emailHash: 1, createdAt: -1 });

ApplicationSchema.statics.findOneByEmail = function(email) {
  const normalizedEmail = normalizeEmail(email);
  const emailHashes = typeof this.computeBlindIndexVariants === 'function'
    ? this.computeBlindIndexVariants(normalizedEmail, normalizeEmail)
    : [this.computeBlindIndex(normalizedEmail, normalizeEmail)].filter(Boolean);
  const or = [];
  if (emailHashes.length) or.push({ emailHash: { $in: emailHashes } });
  if (normalizedEmail) or.push({ email: normalizedEmail });
  if (!or.length) return this.findOne({ _id: null });
  return this.findOne({ $or: or });
};

applyModelEncryption(ApplicationSchema, {
  encryptedPaths: [
    'fullName',
    'email',
    'phone',
    'branch',
    'college',
    'interests',
    'motivation',
    'experience',
    'availability',
    'socials.linkedin',
    'socials.github',
    'socials.portfolio',
    'notes.text',
    'history.note',
    'inviteCode',
    'source',
    'ip',
    'userAgent',
    'interview.link',
    'interview.location'
  ],
  hashes: [
    { source: 'email', target: 'emailHash', normalize: normalizeEmail },
    { source: 'phone', target: 'phoneHash', normalize: normalizePhone },
  ],
});

module.exports = mongoose.model('Application', ApplicationSchema);

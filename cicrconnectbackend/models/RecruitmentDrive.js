const mongoose = require('mongoose');

const FormFieldSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'textarea', 'select', 'multiselect', 'radio', 'checkbox'], required: true },
  options: [{ type: String }], // Used for select, multiselect, radio
  required: { type: Boolean, default: false }
}, { _id: false });

const RecruitmentDriveSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    positions: [{ type: String, trim: true, maxlength: 100 }],
    eligibleYears: [{ type: Number, min: 1, max: 6 }],
    deadline: { type: Date, required: true },
    isOpen: { type: Boolean, default: true },
    formSchema: [FormFieldSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

RecruitmentDriveSchema.index({ isOpen: 1, deadline: 1 });

module.exports = mongoose.model('RecruitmentDrive', RecruitmentDriveSchema);

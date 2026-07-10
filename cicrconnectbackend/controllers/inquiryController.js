const Inquiry = require('../models/Inquiry');
const { createNotifications } = require('../utils/notificationService');
const User = require('../models/User');

exports.submitInquiry = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const inquiry = await Inquiry.create({ name, email, subject, message });

    // Notify admins about the new inquiry
    const admins = await User.find({ role: 'Admin' }).select('_id');
    const adminIds = admins.map(a => a._id);
    
    if (adminIds.length > 0) {
      await createNotifications({
        userIds: adminIds,
        title: 'New Inquiry Received',
        message: `${name} has submitted a new inquiry: ${subject}`,
        type: 'info',
        link: '/admin', // Assuming admins check inquiries in admin center
      });
    }

    res.status(201).json({ success: true, inquiry });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({ message: 'Failed to submit inquiry' });
  }
};

exports.getInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ submittedAt: -1 });
    res.json(inquiries);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch inquiries' });
  }
};

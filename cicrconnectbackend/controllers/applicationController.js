const crypto = require('crypto');
const Application = require('../models/Application');
const Event = require('../models/Event');
const InviteCode = require('../models/InviteCode');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');
const { normalizeEmail } = require('../utils/fieldCrypto');

const STATUS_OPTIONS = ['New', 'InReview', 'Interview', 'Accepted', 'Selected', 'Rejected'];

const sanitize = (value) => String(value || '').trim();
const resolveFrontendUrl = () => {
  const raw = sanitize(process.env.FRONTEND_URL);
  if (!raw) return 'https://cicrconnect.vercel.app';
  const first = raw
    .split(',')
    .map((v) => sanitize(v))
    .find(Boolean);
  return first || 'https://cicrconnect.vercel.app';
};
const normalizeStatus = (value) => {
  const raw = sanitize(value);
  if (!raw) return null;
  const match = STATUS_OPTIONS.find((status) => status.toLowerCase() === raw.toLowerCase());
  return match || null;
};

const createApplication = async (req, res) => {
  try {
    if (sanitize(req.body.website)) {
      return res.json({ success: true, message: 'Application received.' });
    }

    const email = normalizeEmail(req.body.email);
    const phone = sanitize(req.body.phone);
    const fullName = sanitize(req.body.fullName);
    const parsedYear = Number(req.body.year);
    const year = Number.isFinite(parsedYear) ? parsedYear : null;

    const emailHashes = typeof Application.computeBlindIndexVariants === 'function'
      ? Application.computeBlindIndexVariants(email, normalizeEmail)
      : [Application.computeBlindIndex(email, normalizeEmail)].filter(Boolean);

    const existing = await Application.findOne({
      status: { $ne: 'Rejected' },
      $or: [
        ...(emailHashes.length ? [{ emailHash: { $in: emailHashes } }] : []),
        ...(email ? [{ email }] : []),
      ],
    }).sort({ createdAt: -1 });

    if (existing) {
      return res.status(409).json({ message: 'We already have an active application from this email.' });
    }

    let linkedEvent = null;
    if (req.body.eventId) {
      const event = await Event.findById(req.body.eventId);
      if (!event) {
        return res.status(400).json({ message: 'Selected event is invalid.' });
      }
      if (!event.allowApplications) {
        return res.status(400).json({ message: 'Applications are not open for this event.' });
      }
      if (event.applicationDeadline && event.applicationDeadline < new Date()) {
        return res.status(400).json({ message: 'Application deadline has passed for this event.' });
      }
      linkedEvent = event._id;
    }

    let linkedDrive = null;
    if (req.body.recruitmentDriveId) {
      const RecruitmentDrive = require('../models/RecruitmentDrive');
      const drive = await RecruitmentDrive.findById(req.body.recruitmentDriveId);
      if (!drive) {
        return res.status(400).json({ message: 'Selected recruitment drive is invalid.' });
      }
      if (!drive.isOpen) {
        return res.status(400).json({ message: 'This recruitment drive is currently closed.' });
      }
      if (drive.deadline && drive.deadline < new Date()) {
        return res.status(400).json({ message: 'Deadline has passed for this recruitment drive.' });
      }
      linkedDrive = drive._id;
    }

    const application = await Application.create({
      fullName,
      email,
      phone,
      year: year ? Number(year) : undefined,
      branch: sanitize(req.body.branch),
      college: sanitize(req.body.college),
      interests: Array.isArray(req.body.interests)
        ? req.body.interests.map((v) => sanitize(v)).filter(Boolean)
        : sanitize(req.body.interests)
            .split(',')
            .map((v) => sanitize(v))
            .filter(Boolean),
      motivation: sanitize(req.body.motivation),
      experience: sanitize(req.body.experience),
      availability: sanitize(req.body.availability),
      socials: {
        linkedin: sanitize(req.body.linkedin),
        github: sanitize(req.body.github),
        portfolio: sanitize(req.body.portfolio),
      },
      event: linkedEvent,
      recruitmentDrive: linkedDrive,
      dynamicResponses: req.body.dynamicResponses || {},
      source: sanitize(req.body.source) || 'public-form',
      ip: sanitize(req.ip),
      userAgent: sanitize(req.get('user-agent')),
    });

    const reviewers = await User.find({
      role: { $in: ['Admin', 'Head'] },
      $or: [{ isVerified: true }, { approvalStatus: 'Approved' }],
    }).select('_id');
    await createNotifications({
      userIds: reviewers.map((u) => u._id),
      title: 'New Recruitment Application',
      message: `${fullName} submitted an application.`,
      type: 'action',
      link: '/admin',
      meta: {
        applicationId: application._id,
        eventId: linkedEvent ? String(linkedEvent) : null,
      },
      createdBy: req.user?.id || null,
    });

    await logAudit({
      actor: req.user?.id || null,
      action: 'APPLICATION_CREATED',
      entityType: 'Application',
      entityId: application._id,
      after: {
        fullName: application.fullName,
        email: application.email,
        status: application.status,
      },
      req,
    });

    res.status(201).json({ success: true, id: application._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getApplications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const query = {};
    const status = normalizeStatus(req.query.status);
    if (status) {
      query.status = status;
    }

    if (req.query.recruitmentDrive) {
      query.recruitmentDrive = req.query.recruitmentDrive;
    }
    
    if (req.query.eventId) {
      query.event = req.query.eventId;
    }

    if (req.query.q) {
      const needle = String(req.query.q || '').trim();
      const regex = new RegExp(needle, 'i');
      query.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
        { branch: regex },
        { college: regex }
      ];
    }

    const applications = await Application.find(query)
      .populate('assignedTo', 'name role')
      .populate('event', 'title type startTime')
      .populate('notes.author', 'name role')
      .populate('history.changedBy', 'name role')
      .populate('inviteSentBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const before = {
      status: application.status,
      stage: application.stage,
      assignedTo: application.assignedTo ? String(application.assignedTo) : null,
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const status = normalizeStatus(req.body.status);
      if (!status) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      if (application.status === 'Selected' || application.status === 'Rejected') {
        return res.status(400).json({ message: `Cannot change status of a ${application.status} application.` });
      }
      if (status !== application.status) {
        application.status = status;
        application.history.unshift({
          status,
          changedBy: req.user.id,
          note: sanitize(req.body.note),
        });
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')) {
      const assignedTo = sanitize(req.body.assignedTo);
      if (!assignedTo) {
        application.assignedTo = null;
      } else {
        const assignee = await User.findById(assignedTo).select('role isVerified approvalStatus');
        if (!assignee) {
          return res.status(400).json({ message: 'Assigned reviewer was not found.' });
        }
        const role = String(assignee.role || '').toLowerCase();
        const approval = String(assignee.approvalStatus || '').toLowerCase();
        const isApproved = assignee.isVerified || approval === 'approved';
        if (!isApproved || (role !== 'admin' && role !== 'head')) {
          return res.status(400).json({ message: 'Assigned reviewer must be an approved Admin/Head account.' });
        }
        application.assignedTo = assignee._id;
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'stage')) {
      application.stage = sanitize(req.body.stage) || application.stage;
    }

    if (sanitize(req.body.note)) {
      application.notes.unshift({
        text: sanitize(req.body.note),
        author: req.user.id,
      });
    }

    const updated = await application.save();
    const populated = await updated.populate([
      { path: 'assignedTo', select: 'name role' },
      { path: 'event', select: 'title type startTime' },
      { path: 'notes.author', select: 'name role' },
      { path: 'history.changedBy', select: 'name role' },
      { path: 'inviteSentBy', select: 'name role' },
    ]);

    if (application.assignedTo) {
      await createNotifications({
        userIds: [application.assignedTo],
        title: 'Application Assignment Updated',
        message: `You are assigned to review ${application.fullName}.`,
        type: 'info',
        link: '/admin',
        meta: { applicationId: application._id, status: application.status },
        createdBy: req.user.id,
      });
    }

    await logAudit({
      actor: req.user.id,
      action: 'APPLICATION_UPDATED',
      entityType: 'Application',
      entityId: application._id,
      before,
      after: {
        status: application.status,
        stage: application.stage,
        assignedTo: application.assignedTo ? String(application.assignedTo) : null,
      },
      meta: {
        note: sanitize(req.body.note) || null,
      },
      req,
    });

    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const sendApplicationInvite = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    let newCode;
    let attempts = 0;
    while (!newCode && attempts < 5) {
      attempts += 1;
      const codeString = crypto.randomBytes(4).toString('hex').toUpperCase();
      try {
        newCode = await InviteCode.create({
          code: codeString,
          createdBy: req.user.id,
        });
      } catch (err) {
        if (err?.code !== 11000) {
          throw err;
        }
      }
    }

    if (!newCode) {
      return res.status(500).json({ message: 'Could not generate unique invite code. Try again.' });
    }

    application.inviteCode = newCode.code;
    application.inviteSentAt = new Date();
    application.inviteSentBy = req.user.id;
    if (application.status !== 'Selected') {
      application.status = 'Selected';
      application.history.unshift({
        status: 'Selected',
        changedBy: req.user.id,
        note: 'Invite sent to applicant.',
      });
    }
    await application.save();

    const frontendUrl = resolveFrontendUrl();
    const registerLink = `${frontendUrl}/login`;

    const emailMessage = `
      <div style="font-family: sans-serif; max-width: 640px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">CICR Connect Invitation</h2>
        <p>You have been selected to proceed with CICR onboarding. Use the invite code below during registration.</p>
        <div style="background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${newCode.code}</span>
        </div>
        <p>Register here:</p>
        <a href="${registerLink}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;">
          Open CICR Portal
        </a>
        <p style="margin-top:16px;font-size:12px;color:#6b7280;">If you did not request this, you can ignore this email.</p>
      </div>
    `;

    await sendEmail({
      email: application.email,
      subject: 'CICR Connect Invitation',
      message: emailMessage,
    });

    if (application.inviteSentBy) {
      await createNotifications({
        userIds: [application.inviteSentBy],
        title: 'Recruitment Invite Sent',
        message: `Invite sent to ${application.fullName} (${application.email}).`,
        type: 'success',
        link: '/admin',
        meta: { applicationId: application._id, inviteCode: newCode.code },
        createdBy: req.user.id,
      });
    }

    await logAudit({
      actor: req.user.id,
      action: 'APPLICATION_INVITE_SENT',
      entityType: 'Application',
      entityId: application._id,
      after: {
        status: application.status,
        inviteCode: newCode.code,
      },
      req,
    });

    res.json({ success: true, inviteCode: newCode.code });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const scheduleInterview = async (req, res) => {
  try {
    const { date, location, link } = req.body;
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.interview = {
      date: date || application.interview?.date,
      location: location || application.interview?.location,
      link: link || application.interview?.link,
      marks: application.interview?.marks
    };
    
    application.status = 'Interview';
    application.history.unshift({
      status: 'Interview',
      changedBy: req.user.id,
      note: `Interview scheduled for ${new Date(date).toLocaleString()}`
    });

    await application.save();

    const emailMessage = `
      <div style="font-family: sans-serif; max-width: 640px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
        <h2 style="color: #0f172a; margin-bottom: 8px;">Interview Invitation - CICR</h2>
        <p>Dear ${application.fullName},</p>
        <p>We are pleased to invite you for an interview for your recent application.</p>
        <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
          <p style="margin:0 0 8px 0;"><strong>Date & Time:</strong> ${new Date(date).toLocaleString()}</p>
          ${location ? `<p style="margin:0 0 8px 0;"><strong>Location:</strong> ${location}</p>` : ''}
          ${link ? `<p style="margin:0;"><strong>Meeting Link:</strong> <a href="${link}">${link}</a></p>` : ''}
        </div>
        <p>Please be prepared and join 5 minutes early.</p>
        <p>Best regards,<br/>The CICR Team</p>
      </div>
    `;

    await sendEmail({
      email: application.email,
      subject: 'Interview Invitation - CICR',
      message: emailMessage,
    });

    res.json({ success: true, message: 'Interview scheduled and email sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const gradeInterview = async (req, res) => {
  try {
    const { marks, note } = req.body;
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.interview.marks = marks;
    
    if (note) {
      application.notes.push({
        text: note,
        author: req.user.id
      });
    }

    await application.save();
    res.json({ success: true, message: 'Interview graded successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const finalizeApplication = async (req, res) => {
  try {
    const { action } = req.body; // 'Accept' or 'Reject'
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    if (action === 'Reject') {
      application.status = 'Rejected';
      application.history.unshift({
        status: 'Rejected',
        changedBy: req.user.id,
        note: 'Application rejected.'
      });
      await application.save();

      const emailMessage = `
        <div style="font-family: sans-serif; max-width: 640px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">Update on your CICR Application</h2>
          <p>Dear ${application.fullName},</p>
          <p>Thank you for taking the time to apply and interview with us. We appreciate your interest and the effort you put into the process.</p>
          <p>After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.</p>
          <p>We encourage you to stay connected with our community and apply again in the future.</p>
          <p>Best regards,<br/>The CICR Team</p>
        </div>
      `;

      await sendEmail({
        email: application.email,
        subject: 'Update on your CICR Application',
        message: emailMessage,
      });

      return res.json({ success: true, message: 'Application rejected and email sent' });
    } else if (action === 'Accept') {
      const User = require('../models/User');
      const { normalizeEmail } = require('../utils/fieldCrypto');
      
      const emailBlindIndex = User.computeBlindIndex ? User.computeBlindIndex(application.email, normalizeEmail) : null;
      let existingUser = null;
      if (emailBlindIndex) {
        existingUser = await User.findOne({ emailHash: emailBlindIndex });
      }

      if (existingUser) {
        if (application.status !== 'Selected') {
          application.status = 'Selected';
          application.history.unshift({
            status: 'Selected',
            changedBy: req.user.id,
            note: 'Application accepted. User already exists.',
          });
          await application.save();
        }

        const emailMessage = `
          <div style="font-family: sans-serif; max-width: 640px; margin: auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
            <h2 style="color: #0f172a; margin-bottom: 8px;">Congratulations! You have been selected.</h2>
            <p>Dear ${application.fullName},</p>
            <p>We are thrilled to inform you that you have been selected to join CICR!</p>
            <p>Our records indicate that you already have an active account on the CICR Connect portal.</p>
            <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
              <p style="margin:0;">Please log in to your existing account to view further onboarding instructions.</p>
            </div>
            <a href="${resolveFrontendUrl()}/login" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;">
              Log in to CICR Portal
            </a>
            <p style="margin-top:16px;font-size:12px;color:#6b7280;">Best regards,<br/>The CICR Team</p>
          </div>
        `;

        await sendEmail({
          email: application.email,
          subject: 'You have been selected for CICR!',
          message: emailMessage,
        });

        return res.json({ success: true, message: 'User already exists. Marked as Selected and email sent.' });
      }

      // If user does not exist, use standard invite flow
      req.params.id = application._id;
      return module.exports.sendApplicationInvite(req, res);
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createApplication,
  getApplications,
  updateApplication,
  sendApplicationInvite,
  scheduleInterview,
  gradeInterview,
  finalizeApplication
};

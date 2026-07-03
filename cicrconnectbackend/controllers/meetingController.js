const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { authorizeAction } = require('../utils/policyEngine');
const { createNotifications } = require('../utils/notificationService');
const { logAudit } = require('../utils/auditLogger');

/**
 * @desc    Schedule a new meeting
 * @route   POST /api/meetings
 * @access  Private
 */
exports.scheduleMeeting = async (req, res) => {
    try {
        const { title, meetingType, details, startTime, endTime, participants } = req.body;

        // 1. Double check required fields match your Schema
        if (!title || !meetingType || !details?.topic || !details?.location || !startTime || !endTime) {
            return res.status(400).json({ message: "Please provide all required fields." });
        }

        const scheduleDecision = authorizeAction('SCHEDULE_MEETING', req.user);
        if (!scheduleDecision.allowed) {
            return res.status(403).json({ message: scheduleDecision.reason });
        }

        const participantIds = Array.isArray(participants) ? [...new Set(participants.filter(Boolean))] : [];
        const participantUsers = participantIds.length
            ? await User.find({ _id: { $in: participantIds } }).select('year role')
            : [];

        if (participantIds.length && participantUsers.length !== participantIds.length) {
            return res.status(400).json({ message: 'Some participants could not be found.' });
        }

        if (participantUsers.length) {
            const teamDecision = authorizeAction('MANAGE_TEAM', req.user, { members: participantUsers });
            if (!teamDecision.allowed) {
                return res.status(403).json({ message: teamDecision.reason });
            }
        }

        // 3. Create meeting using 'organizedBy' (matching your Schema)
        const newMeeting = new Meeting({
            title,
            meetingType,
            details, // This contains topic, location, and optionally agenda
            startTime,
            endTime,
            participants: participantIds,
            organizedBy: req.user.id // Taken from the 'protect' middleware
        });

        // 3. Save to MongoDB
        const savedMeeting = await newMeeting.save();
        
        // 4. Populate for the response
        const populatedMeeting = await Meeting.findById(savedMeeting._id)
            .populate('organizedBy', 'name role')
            .populate('participants', 'name branch');

        await createNotifications({
            userIds: participantIds.filter((id) => String(id) !== String(req.user.id)),
            title: 'New Meeting Scheduled',
            message: `${req.user.name || 'A senior'} scheduled "${title}".`,
            type: 'action',
            link: '/meetings',
            meta: { meetingId: savedMeeting._id, meetingType },
            createdBy: req.user.id,
        });

        await logAudit({
            actor: req.user.id,
            action: 'MEETING_SCHEDULED',
            entityType: 'Meeting',
            entityId: savedMeeting._id,
            after: {
                title,
                meetingType,
                participantCount: participantIds.length,
                startTime,
                endTime,
            },
            req,
        });

        res.status(201).json(populatedMeeting);
    } catch (err) {
        console.error("Meeting Save Error:", err.message);
        res.status(500).json({ message: "Server error: " + err.message });
    }
};

/**
 * @desc    Get all meetings for the user
 * @route   GET /api/meetings
 */
exports.getMeetings = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const skip = (page - 1) * limit;

        const meetings = await Meeting.find({
            $or: [
                { organizedBy: req.user.id },
                { participants: req.user.id }
            ]
        })
        .populate('organizedBy', 'name')
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit);

        res.status(200).json(meetings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

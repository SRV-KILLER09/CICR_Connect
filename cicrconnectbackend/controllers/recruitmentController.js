const RecruitmentDrive = require('../models/RecruitmentDrive');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

exports.createDrive = async (req, res, next) => {
  try {
    const { title, description, positions, eligibleYears, deadline, formSchema, isOpen } = req.body;

    const drive = await RecruitmentDrive.create({
      title,
      description,
      positions,
      eligibleYears,
      deadline,
      formSchema,
      isOpen,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Recruitment drive created successfully',
      data: drive
    });
  } catch (error) {
    next(error);
  }
};

exports.updateDrive = async (req, res, next) => {
  try {
    const drive = await RecruitmentDrive.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!drive) {
      return next(new AppError('Recruitment drive not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Recruitment drive updated successfully',
      data: drive
    });
  } catch (error) {
    next(error);
  }
};

exports.getDrives = async (req, res, next) => {
  try {
    const query = {};
    
    // If not admin/head or explicit public request, only return open drives
    const isAdmin = req.user && ['admin', 'head'].includes(req.user.role?.toLowerCase());
    if (!isAdmin || req.query.public === 'true') {
      query.isOpen = true;
      query.deadline = { $gte: new Date() };
    }

    const drives = await RecruitmentDrive.find(query)
      .populate('createdBy', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: drives.length,
      data: drives
    });
  } catch (error) {
    next(error);
  }
};

exports.getDrive = async (req, res, next) => {
  try {
    const drive = await RecruitmentDrive.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!drive) {
      return next(new AppError('Recruitment drive not found', 404));
    }

    res.status(200).json({
      success: true,
      data: drive
    });
  } catch (error) {
    next(error);
  }
};

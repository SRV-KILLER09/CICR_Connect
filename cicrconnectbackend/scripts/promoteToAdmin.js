require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB } = require('../config/db');

const promoteToAdmin = async () => {
  const args = process.argv.slice(2);
  const identifier = args[0];

  if (!identifier) {
    console.error('Usage: node scripts/promoteToAdmin.js <email-or-collegeId>');
    process.exit(1);
  }

  await connectDB();

  try {
    let user = null;
    if (identifier.includes('@')) {
      user = await User.findOneByEmail(identifier);
    } else {
      user = await User.findOneByCollegeId(identifier);
    }

    if (!user) {
      console.error('User not found.');
      process.exit(1);
    }

    // Since we are creating a strict block on 'Admin' via 'name' later, we bypass it here
    // because we are using a secure script and filtering by email/collegeId.
    // However, to be absolutely certain we don't trigger our future strict hook (which might just block ALL admin assignments without a flag),
    // we use a special flag.
    user.$isScriptEscalation = true; // Just in case we add a hook checking this
    user.role = 'Admin';
    user.isVerified = true;
    user.approvalStatus = 'Approved';
    
    await user.save({ validateBeforeSave: false }); // Skip complex validations if needed, though they should pass
    
    console.log(`Successfully promoted ${user.name} (${user.email}) to Admin.`);
    process.exit(0);
  } catch (error) {
    console.error('Error promoting to admin:', error);
    process.exit(1);
  }
};

promoteToAdmin();

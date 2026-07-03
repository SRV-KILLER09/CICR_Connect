require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB } = require('../config/db');

const backfillSortableName = async () => {
  await connectDB();
  
  try {
    console.log('Starting sortableName backfill...');
    const users = await User.find({});
    let count = 0;
    
    for (const user of users) {
      const expectedSortableName = String(user.name || '').toLowerCase().trim();
      if (user.sortableName !== expectedSortableName) {
        user.sortableName = expectedSortableName;
        // Turn off validation to avoid issues with missing fields
        await user.save({ validateBeforeSave: false });
        count++;
      }
    }
    
    console.log(`Successfully backfilled sortableName for ${count} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  }
};

backfillSortableName();

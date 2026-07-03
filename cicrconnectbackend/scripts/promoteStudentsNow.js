require('dotenv').config();
const mongoose = require('mongoose');
const { promoteStudents } = require('../jobs/yearPromotion');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB. Starting manual promotion...');
    await promoteStudents();
    console.log('Promotion complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Application = require('./models/Application');
  const app = await Application.findOne().sort({ createdAt: -1 });
  if (!app) { console.log('No app found'); process.exit(1); }
  
  app.status = 'InReview';
  app.history.unshift({
    status: 'InReview',
    changedBy: '648c8b1a8d3e2a1234567890', // fake valid objectid
    note: ''
  });
  
  try {
    await app.save();
    console.log('Success');
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
});

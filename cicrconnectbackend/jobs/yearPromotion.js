const cron = require('node-cron');
const User = require('../models/User');

const promoteStudents = async () => {
  console.log('Running annual year promotion...');
  try {
    const users = await User.find({ role: { $in: ['User', 'Admin', 'Head'] } });
    
    let promotedCount = 0;
    let alumniCount = 0;

    for (const user of users) {
      if (!user.year) continue;

      if (user.year >= 4) {
        if (user.role === 'User') {
          user.role = 'Alumni';
        }
        
        if (!user.alumniProfile) {
          user.alumniProfile = { graduationYear: new Date().getFullYear() };
        } else if (!user.alumniProfile.graduationYear) {
          user.alumniProfile.graduationYear = new Date().getFullYear();
        }
        alumniCount++;
      } else {
        user.year += 1;
        promotedCount++;
      }
      
      await user.save({ validateBeforeSave: false });
    }
    
    console.log(`Annual promotion complete: ${promotedCount} students promoted, ${alumniCount} graduated to Alumni.`);
  } catch (error) {
    console.error('Error during annual year promotion:', error);
  }
};

// Schedule for June 1st every year
const initYearPromotionCron = () => {
  cron.schedule('0 0 1 6 *', () => {
    promoteStudents();
  });
  console.log('Year promotion cron job initialized (runs every June 1st).');
};

module.exports = { initYearPromotionCron, promoteStudents };

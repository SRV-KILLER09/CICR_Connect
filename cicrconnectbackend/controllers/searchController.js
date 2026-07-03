const User = require('../models/User');
const Event = require('../models/Event');

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ users: [], events: [] });
    }

    const searchQuery = new RegExp(q.trim(), 'i');

    // Run searches in parallel to optimize speed
    // Limit to 5 results per category to minimize DB load and bandwidth
    const [users, events] = await Promise.all([
      User.find({
        $or: [
          { name: searchQuery },
          { role: searchQuery }
        ]
      })
      .select('name role avatarUrl')
      .limit(5)
      .lean(),

      Event.find({
        $or: [
          { title: searchQuery },
          { description: searchQuery }
        ]
      })
      .select('title date type')
      .limit(5)
      .lean()
    ]);

    res.json({ success: true, results: { users, events } });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

const User = require('../models/User');
const Result = require('../models/Result');
const AssessmentSession = require('../models/AssessmentSession');
const SharedUserID = require('../models/SharedUserID');
const { generatePDF, generateCSV } = require('../utils/exportHelper');

exports.getDashboard = async (req, res, next) => {
  try {
    const [totalUsers, completedSessions, inProgressSessions, activeSharedCodes, results] = await Promise.all([
      User.countDocuments({ isVerified: true }),
      AssessmentSession.countDocuments({ status: 'submitted' }),
      AssessmentSession.countDocuments({ status: 'in-progress' }),
      SharedUserID.countDocuments({ isActive: true }),
      Result.find().sort({ createdAt: -1 }),
    ]);

    const scores = results.map(r => r.totalMarks);
    const avgScore = scores.length ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    const highestScore = scores.length ? Math.max(...scores) : 0;
    const lowestScore = scores.length ? Math.min(...scores) : 0;

    // Last 30 days bar chart
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const countByDay = {};
    for (const r of results) {
      const day = r.createdAt.toISOString().split('T')[0];
      countByDay[day] = (countByDay[day] || 0) + 1;
    }
    const barChart = { labels: days, data: days.map(d => countByDay[d] || 0) };

    // Business distribution doughnut
    const businessCount = {};
    for (const r of results) {
      for (const b of (r.recommendedBusiness || [])) {
        businessCount[b] = (businessCount[b] || 0) + 1;
      }
    }
    const pieChart = {
      labels: Object.keys(businessCount),
      data: Object.values(businessCount),
    };

    const recentResults = await Result.find()
      .sort({ createdAt: -1 }).limit(10)
      .populate('userId', 'name email sharedCode');

    res.json({
      success: true,
      cards: { totalUsersRegistered: totalUsers, totalAssessmentsCompleted: completedSessions, totalAssessmentsInProgress: inProgressSessions, averageScore: avgScore, highestScore, lowestScore, activeSharedCodes },
      barChart, pieChart, recentResults,
    });
  } catch (err) { next(err); }
};

const SORT_OPTIONS = {
  'date-desc': { createdAt: -1 },
  'date-asc': { createdAt: 1 },
  'score-desc': { totalMarks: -1 },
  'score-asc': { totalMarks: 1 },
};

exports.getResults = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, search, dateFrom, dateTo, level, business, sortBy } = req.query;
    const filter = {};
    if (level) filter.level = level;
    if (business) filter.recommendedBusiness = new RegExp(business, 'i');
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59,999); filter.createdAt.$lte = to; }
    }

    let query = Result.find(filter).populate('userId', 'name email sharedCode');

    if (search) {
      const users = await User.find({
        $or: [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
          { sharedCode: new RegExp(search, 'i') },
        ]
      }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
      query = Result.find(filter).populate('userId', 'name email sharedCode');
    }

    const total = await Result.countDocuments(filter);
    const results = await query
      .sort(SORT_OPTIONS[sortBy] || SORT_OPTIONS['date-desc'])
      .skip((+page - 1) * +limit)
      .limit(+limit);

    res.json({ success: true, data: results, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) { next(err); }
};

exports.exportPDF = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, level, business, ids } = req.query;
    const filter = {};
    if (ids) filter._id = { $in: ids.split(',') };
    if (level) filter.level = level;
    if (business) filter.recommendedBusiness = new RegExp(business, 'i');
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59,999); filter.createdAt.$lte = to; }
    }

    const results = await Result.find(filter).populate('userId', 'name email sharedCode').sort({ createdAt: -1 });
    const date = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tbt_results_${date}.pdf"`);

    const doc = generatePDF(results);
    doc.pipe(res);
    doc.end();
  } catch (err) { next(err); }
};

exports.exportCSV = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, level, business, ids } = req.query;
    const filter = {};
    if (ids) filter._id = { $in: ids.split(',') };
    if (level) filter.level = level;
    if (business) filter.recommendedBusiness = new RegExp(business, 'i');
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59,999); filter.createdAt.$lte = to; }
    }

    const results = await Result.find(filter).populate('userId', 'name email sharedCode').sort({ createdAt: -1 });
    const date = new Date().toISOString().split('T')[0];
    const csv = generateCSV(results);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tbt_results_${date}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
};

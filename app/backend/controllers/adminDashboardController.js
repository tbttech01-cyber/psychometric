const User = require('../models/User');
const Result = require('../models/Result');
const AssessmentSession = require('../models/AssessmentSession');
const SharedUserID = require('../models/SharedUserID');
const Setting = require('../models/Setting');
const { generatePDF, generateCSV } = require('../utils/exportHelper');
const escapeRegExp = require('../utils/escapeRegExp');
const RetestRequest = require('../models/RetestRequest');

exports.getDashboard = async (req, res, next) => {
  try {
    const [totalUsers, completedSessions, inProgressSessions, activeSharedCodes, results] = await Promise.all([
      User.countDocuments({ isVerified: true }),
      AssessmentSession.countDocuments({ status: 'submitted' }),
      AssessmentSession.countDocuments({ status: 'in-progress' }),
      SharedUserID.countDocuments({ isActive: true }),
      Result.find().sort({ createdAt: -1 }),
    ]);

    // Percentage, not raw points — categories/questions can be added or
    // removed over time, so different results may have different maxScore
    // values, making raw totalMarks not directly comparable across them.
    const scores = results.map(r => r.percentage);
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
    if (business) filter.recommendedBusiness = new RegExp(escapeRegExp(business), 'i');
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59,999); filter.createdAt.$lte = to; }
    }

    let query = Result.find(filter).populate('userId', 'name email sharedCode');

    if (search) {
      const re = new RegExp(escapeRegExp(search), 'i');
      const users = await User.find({
        $or: [{ name: re }, { email: re }, { sharedCode: re }]
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

exports.deleteResult = async (req, res, next) => {
  try {
    const doc = await Result.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.getResultById = async (req, res, next) => {
  try {
    const doc = await Result.findById(req.params.id).populate('userId', 'name email sharedCode');
    if (!doc) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.getResultsByUser = async (req, res, next) => {
  try {
    const data = await Result.find({ userId: req.params.userId })
      .populate('userId', 'name email sharedCode')
      .sort({ createdAt: -1 });
    res.json({ success: true, data, total: data.length });
  } catch (err) { next(err); }
};

exports.exportPDF = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, level, business, ids } = req.query;
    const filter = {};
    if (ids) filter._id = { $in: ids.split(',') };
    if (level) filter.level = level;
    if (business) filter.recommendedBusiness = new RegExp(escapeRegExp(business), 'i');
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
    if (business) filter.recommendedBusiness = new RegExp(escapeRegExp(business), 'i');
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

exports.getSettings = async (req, res, next) => {
  try {
    const duration = await Setting.findOne({ key: 'assessment_duration_minutes' });
    res.json({
      success: true,
      data: {
        assessment_duration_minutes: duration ? Number(duration.value) : 30
      }
    });
  } catch (err) { next(err); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { assessment_duration_minutes } = req.body;
    if (assessment_duration_minutes == null || isNaN(Number(assessment_duration_minutes)) || Number(assessment_duration_minutes) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid assessment duration.' });
    }
    await Setting.findOneAndUpdate(
      { key: 'assessment_duration_minutes' },
      { value: Number(assessment_duration_minutes) },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) { next(err); }
};

// --- Retest requests ---------------------------------------------------------

const RETEST_STATUSES = ['pending', 'approved', 'rejected', 'used', 'expired'];

// List retest requests, optionally filtered by status (the admin page's tabs).
// `counts` per status powers the tab counters and the sidebar notification badge.
exports.listRetestRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && RETEST_STATUSES.includes(status)) filter.status = status;
    const data = await RetestRequest.find(filter).sort('-createdAt').limit(500);
    const counts = await RetestRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const countMap = counts.reduce((m, c) => { m[c._id] = c.n; return m; }, {});
    res.json({ success: true, data, total: data.length, counts: countMap });
  } catch (err) { next(err); }
};

// Detail view: the request + its snapshotted current result (dimension scores,
// recommendations) + the candidate's full attempt history.
exports.getRetestRequest = async (req, res, next) => {
  try {
    const reqDoc = await RetestRequest.findById(req.params.id)
      .populate('currentResultId')
      .populate('decidedBy', 'email');
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Request not found.' });
    const history = await Result.find({ userId: reqDoc.userId }).sort('-createdAt')
      .select('attemptNumber percentage level totalMarks maxScore createdAt');
    res.json({ success: true, data: reqDoc, history });
  } catch (err) { next(err); }
};

// Approve a PENDING request → 'approved'. Grants exactly one retest; the
// candidate's next startSession consumes it (marks it 'used').
exports.approveRetest = async (req, res, next) => {
  try {
    const reqDoc = await RetestRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (reqDoc.status !== 'pending')
      return res.status(400).json({ success: false, message: `Cannot approve a request that is '${reqDoc.status}'.` });
    reqDoc.status = 'approved';
    reqDoc.decidedBy = req.admin && req.admin._id;
    reqDoc.decidedAt = new Date();
    reqDoc.rejectionNote = undefined;
    await reqDoc.save();
    res.json({ success: true, message: 'Retest approved. The candidate can now retake the assessment once.' });
  } catch (err) { next(err); }
};

// Reject a PENDING request → 'rejected' with an optional note. The candidate
// may submit a fresh request afterwards.
exports.rejectRetest = async (req, res, next) => {
  try {
    const reqDoc = await RetestRequest.findById(req.params.id);
    if (!reqDoc) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (reqDoc.status !== 'pending')
      return res.status(400).json({ success: false, message: `Cannot reject a request that is '${reqDoc.status}'.` });
    reqDoc.status = 'rejected';
    reqDoc.decidedBy = req.admin && req.admin._id;
    reqDoc.decidedAt = new Date();
    reqDoc.rejectionNote = (req.body && typeof req.body.note === 'string') ? req.body.note.slice(0, 500) : undefined;
    await reqDoc.save();
    res.json({ success: true, message: 'Retest request rejected.' });
  } catch (err) { next(err); }
};

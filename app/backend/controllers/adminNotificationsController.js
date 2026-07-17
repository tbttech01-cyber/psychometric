const Notification = require('../models/Notification');

// Shared admin feed (single-admin platform): notifications aren't scoped per
// admin, so no recipient filter is applied. Kept ready for `recipientAdminId`
// targeting if multi-admin is introduced.
exports.list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const filter = {};
    if (req.query.unread === 'true') filter.isRead = false;

    const [data, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ isRead: false }),
    ]);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit), unreadCount });
  } catch (err) { next(err); }
};

// Cheap endpoint the bell badge polls without transferring the whole feed.
exports.unreadCount = async (req, res, next) => {
  try {
    res.json({ success: true, unreadCount: await Notification.countDocuments({ isRead: false }) });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    const n = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!n) return res.status(404).json({ success: false, message: 'Notification not found.' });
    const unreadCount = await Notification.countDocuments({ isRead: false });
    res.json({ success: true, data: n, unreadCount });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true, readAt: new Date() });
    res.json({ success: true, unreadCount: 0 });
  } catch (err) { next(err); }
};

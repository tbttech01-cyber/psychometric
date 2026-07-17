const router = require('express').Router();
const ctrl = require('../controllers/adminNotificationsController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/notifications', ctrl.list);
router.get('/notifications/unread-count', ctrl.unreadCount);
router.post('/notifications/read-all', ctrl.markAllRead);
router.post('/notifications/:id/read', ctrl.markRead);

module.exports = router;

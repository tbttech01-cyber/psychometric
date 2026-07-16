const router = require('express').Router();
const ctrl = require('../controllers/adminDashboardController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/dashboard', ctrl.getDashboard);
router.get('/results', ctrl.getResults);
// Must precede /results/:id — otherwise "user" would be matched as an :id.
router.get('/results/user/:userId', ctrl.getResultsByUser);
router.get('/results/:id', ctrl.getResultById);
router.delete('/results/:id', ctrl.deleteResult);
router.get('/export/pdf', ctrl.exportPDF);
router.get('/export/csv', ctrl.exportCSV);
router.get('/settings', ctrl.getSettings);
router.post('/settings', ctrl.updateSettings);

router.get('/retest-requests', ctrl.listRetestRequests);
router.get('/retest-requests/:id', ctrl.getRetestRequest);
router.post('/retest-requests/:id/approve', ctrl.approveRetest);
router.post('/retest-requests/:id/reject', ctrl.rejectRetest);

module.exports = router;

const router = require('express').Router();
const ctrl = require('../controllers/adminDashboardController');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/dashboard', ctrl.getDashboard);
router.get('/results', ctrl.getResults);
router.delete('/results/:id', ctrl.deleteResult);
router.get('/export/pdf', ctrl.exportPDF);
router.get('/export/csv', ctrl.exportCSV);

module.exports = router;

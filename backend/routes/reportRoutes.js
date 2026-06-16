const express = require('express');
const { getInventoryReport, getFineReport, exportCsv } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/inventory', protect, authorize('admin', 'librarian'), getInventoryReport);
router.get('/fines', protect, authorize('admin', 'librarian'), getFineReport);
router.get('/export/:type', protect, authorize('admin', 'librarian'), exportCsv);

module.exports = router;

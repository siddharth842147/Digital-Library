const express = require('express');
const {
    getBooks,
    getBook,
    addBook,
    updateBook,
    deleteBook,
    getCategories,
    getBookStats,
    bulkUploadBooks
} = require('../controllers/bookController');
const { protect, authorize } = require('../middleware/auth');
const { processUpload } = require('../middleware/uploadSecurity');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/books/');
    },
    filename: function (req, file, cb) {
        const randomName = crypto.randomBytes(16).toString('hex');
        cb(null, `book_${randomName}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    // For bulk upload, it might be CSV or Excel
    if (req.path === '/bulk-upload') {
        return cb(null, true);
    }
    
    // For book covers
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

const router = express.Router();

// Public routes
router.route('/')
    .get(getBooks)
    .post(protect, authorize('admin', 'librarian'), upload.single('coverImage'), processUpload, addBook);

router.post('/bulk-upload', protect, authorize('admin'), upload.single('file'), processUpload, bulkUploadBooks);
router.get('/categories/list', getCategories);
router.get('/:id', getBook);

// Protected routes (Admin/Librarian)
router.put('/:id', protect, authorize('admin', 'librarian'), upload.single('coverImage'), processUpload, updateBook);
router.delete('/:id', protect, authorize('admin'), deleteBook);
router.get('/stats/overview', protect, authorize('admin', 'librarian'), getBookStats);

module.exports = router;

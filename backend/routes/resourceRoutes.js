const express = require('express');
const {
    getResources,
    getResource,
    createResource,
    updateResource,
    deleteResource,
    incrementDownload,
    updateResourceStatus,
    upvoteResource
} = require('../controllers/resourceController');

const router = express.Router();

const { protect, authorize, optionalProtect } = require('../middleware/auth');
const { processUpload } = require('../middleware/uploadSecurity');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

// Configure multer for resource uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/resources/');
    },
    filename: function (req, file, cb) {
        const randomName = crypto.randomBytes(16).toString('hex');
        cb(null, `resource_${randomName}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/jpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: fileFilter
});

router.route('/')
    .get(optionalProtect, getResources)
    .post(protect, authorize('admin', 'librarian', 'student'), upload.single('file'), processUpload, createResource);

router.route('/:id')
    .get(getResource)
    .put(protect, authorize('admin', 'librarian'), updateResource)
    .delete(protect, authorize('admin'), deleteResource);

router.put('/:id/status', protect, authorize('admin', 'librarian'), updateResourceStatus);

router.post('/:id/upvote', protect, upvoteResource);

router.put('/:id/download', incrementDownload);

module.exports = router;

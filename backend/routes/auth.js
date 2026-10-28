const express = require('express');
const {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword,
    resetPasswordOtp,
    updateDetails,
    updatePassword,
    verifyOtp,
    refreshToken,
    logout,
    unlockUser
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

const router = express.Router();
const rateLimit = require('express-rate-limit');

// General limiter bypass for other auth routes
const authLimiter = (req, res, next) => next();

// Rate limiter for login route: max 10 requests per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    message: {
        success: false,
        message: 'Too many login attempts from this IP address. Please try again after 15 minutes.'
    }
});

const registerValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email')
        .isEmail().withMessage('Please provide a valid email')
        .matches(/^[a-zA-Z0-9._%+-]+@gmail\.com$/).withMessage('Please provide a valid Gmail address (e.g., user@gmail.com)'),
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('phone')
        .optional()
        .matches(/^[0-9]{10}$/)
        .withMessage('Please provide a valid 10-digit phone number')
];

const loginValidation = [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
];

// Public routes
router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/login', loginLimiter, loginValidation, validate, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:resettoken', authLimiter, resetPassword);
router.post('/reset-password-otp', authLimiter, resetPasswordOtp);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);
router.put('/update-details', protect, updateDetails);
router.put('/update-password', protect, updatePassword);
router.post('/unlock/:userId', protect, authorize('librarian', 'admin'), unlockUser);

module.exports = router;

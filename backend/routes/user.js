const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { getRecommendations } = require('../controllers/chatbotController');

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password')
            .populate('borrowedBooks', 'title author coverImage')
            .populate('wishlist', 'title author coverImage');

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @desc    Get user coins balance and history
// @route   GET /api/user/coins
// @access  Private
router.get('/coins', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const CoinTransaction = require('../models/CoinTransaction');
        const transactions = await CoinTransaction.find({ user: req.user.id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                coins: user.coins || 0,
                transactions
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @desc    Toggle book in wishlist
// @route   POST /api/user/wishlist/:bookId
// @access  Private
router.post('/wishlist/:bookId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const bookId = req.params.bookId;

        if (user.wishlist.includes(bookId)) {
            user.wishlist = user.wishlist.filter(id => id.toString() !== bookId);
        } else {
            user.wishlist.push(bookId);
        }

        await user.save();

        res.status(200).json({
            success: true,
            data: user.wishlist
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @desc    Get AI book recommendations
// @route   GET /api/user/recommendations
// @access  Private
router.get('/recommendations', protect, getRecommendations);

module.exports = router;

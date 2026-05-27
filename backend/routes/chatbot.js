const express = require('express');
const router = express.Router();
const { handleQuery } = require('../controllers/chatbotController');

// Chatbot query route
router.post('/query', handleQuery);

module.exports = router;

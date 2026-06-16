const { GoogleGenerativeAI } = require('@google/generative-ai');
const Book = require('../models/Book');

exports.handleQuery = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ success: false, message: 'Chatbot is not configured properly (API Key missing).' });
        }

        let userContext = "The user is currently not logged in. If they ask for personal account details, ask them to log in to their student portal.";
        if (req.cookies && req.cookies.accessToken) {
            try {
                const token = req.cookies.accessToken;
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const User = require('../models/User');
                const user = await User.findById(decoded.id);
                if (user) {
                    const Borrow = require('../models/Borrow');
                    const Holiday = require('../models/Holiday');
                    const { getFineableDays } = require('../utils/dateUtils');

                    const borrows = await Borrow.find({
                        user: user._id,
                        status: { $in: ['borrowed', 'overdue', 'return_pending'] }
                    });

                    const holidays = await Holiday.find();
                    const finePerDay = parseInt(process.env.FINE_PER_DAY) || 10;
                    const now = new Date();

                    let currentBorrowsAccruedFine = 0;
                    for (const borrow of borrows) {
                        let status = borrow.status;
                        if (status === 'borrowed' && new Date(borrow.dueDate) < now) {
                            status = 'overdue';
                        }
                        if (status === 'overdue' && !borrow.returnDate) {
                            const fineableDays = getFineableDays(borrow.dueDate, now, holidays);
                            currentBorrowsAccruedFine += fineableDays * finePerDay;
                        } else {
                            currentBorrowsAccruedFine += borrow.fine || 0;
                        }
                    }

                    const pendingFines = Math.max(0, (user.totalFines || 0) + currentBorrowsAccruedFine);
                    userContext = `The user IS logged in. Their name is ${user.name}. Their current pending fine is ₹${pendingFines}. Their library coins balance is ${user.coins}. You CAN tell them their fine or coin balance directly!`;
                }
            } catch (err) {
                console.error("Chatbot Auth Error:", err.message);
            }
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        // Prompt engineering to act as a librarian and decide if we need to search the DB
        const systemPrompt = `You are a helpful and polite virtual librarian for the JVIT Digital Library. 
A user has asked: "${message}"

User Context:
${userContext}

First, decide if the user is asking to search for a book, author, or category. 
If they ARE asking for a book search, reply strictly with a JSON object in this format (do not include markdown formatting, just raw JSON):
{"action": "search", "query": "the main search terms or keywords"}

If they are asking a general question (e.g., library hours, late fines, greetings), just reply naturally as a helpful librarian.
Note: Our late fine is ₹10 per day, max 3 books can be borrowed at a time, borrow limit is 14 days. Library is open 9 AM to 5 PM, Mon-Sat.`;

        const result = await model.generateContent(systemPrompt);
        let aiResponse = result.response.text();
        
        // Check if the response is JSON for a search
        try {
            // Clean up possible markdown code blocks around JSON
            let cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            
            if (parsed.action === 'search' && parsed.query) {
                // Perform MongoDB Search
                const searchRegex = new RegExp(parsed.query, 'i');
                const books = await Book.find({
                    $or: [
                        { title: searchRegex },
                        { author: searchRegex },
                        { category: searchRegex }
                    ]
                }).limit(5).select('title author category availableCopies');

                if (books.length === 0) {
                    return res.json({
                        success: true,
                        reply: `I searched the library for "${parsed.query}" but couldn't find any exact matches right now. Can I help you find something else?`
                    });
                }

                // Format the books found to send back to AI for a natural response
                let bookListText = books.map(b => `- "${b.title}" by ${b.author} (${b.category}) - ${b.availableCopies > 0 ? b.availableCopies + ' copies available' : 'Currently checked out'}`).join('\n');
                
                const secondPrompt = `The user asked: "${message}". 
You decided to search the library catalog for "${parsed.query}". 
Here are the search results from the database:
${bookListText}

Write a polite, conversational response to the user presenting these options. Keep it concise.`;

                const finalResult = await model.generateContent(secondPrompt);
                return res.json({
                    success: true,
                    reply: finalResult.response.text()
                });
            }
        } catch (e) {
            // It wasn't JSON, meaning the AI decided to just answer conversationally.
        }

        // Return the conversational AI response
        res.json({
            success: true,
            reply: aiResponse
        });

    } catch (error) {
        console.error('Chatbot Error:', error);
        res.status(500).json({ success: false, message: 'Sorry, I am having trouble connecting to my knowledge base right now.', error: error.message });
    }
};

exports.getRecommendations = async (req, res) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ success: false, message: 'Gemini API not configured' });
        }

        const User = require('../models/User');
        const user = await User.findById(req.user.id).populate('borrowedBooks', 'title author category');

        let prompt = `You are a helpful virtual librarian. The user "${user.name}" wants book recommendations. `;
        
        if (user.borrowedBooks && user.borrowedBooks.length > 0) {
            const history = user.borrowedBooks.map(b => `${b.title} by ${b.author} (${b.category})`).join(', ');
            prompt += `They have previously borrowed these books: ${history}. Based on this, suggest 3 new books they might like that exist in a typical college library. Format as a clean HTML unordered list (<ul><li>...</li></ul>) without any markdown code blocks. Give a brief 1-sentence reason for each.`;
        } else {
            prompt += `They haven't borrowed any books yet. Suggest 3 highly rated, popular books for a college student (mix of technology, science, and self-help). Format as a clean HTML unordered list (<ul><li>...</li></ul>) without any markdown code blocks. Give a brief 1-sentence reason for each.`;
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const result = await model.generateContent(prompt);
        let recommendations = result.response.text();
        
        // Clean up possible markdown code blocks around HTML
        recommendations = recommendations.replace(/```html/g, '').replace(/```/g, '').trim();
        
        res.status(200).json({
            success: true,
            data: recommendations
        });

    } catch (error) {
        console.error('Recommendation Error:', error);
        res.status(500).json({ success: false, message: 'Failed to get recommendations' });
    }
};

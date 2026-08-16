const { GoogleGenerativeAI } = require('@google/generative-ai');
const Book = require('../models/Book');

// Local offline helper for chatbot query
const handleLocalFallback = async (message, userContext) => {
    const query = message.trim().toLowerCase();
    
    if (query.includes('hour') || query.includes('time') || query.includes('open')) {
        return "The JVIT library is open from 9 AM to 5 PM, Monday through Saturday. We are closed on Sundays and public holidays.";
    }
    
    if (query.includes('fine') || query.includes('fee') || query.includes('late')) {
        return "Late returns incur a fee of ₹10 per day. Students can borrow a maximum of 3 books at a time for up to 14 days.";
    }
    
    if (query.includes('limit') || query.includes('max') || query.includes('how many')) {
        return "Students can borrow a maximum of 3 books at a time. The borrow limit is 14 days per book.";
    }
    
    if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('greetings')) {
        return "Hello! I am your Virtual Librarian helper. How can I help you today? You can ask me about library hours, fines, borrow limits, or ask me to search for a book.";
    }

    // Default: Try to search catalog for the query
    // Clean query of common search prefix words
    const isSearchKeywords = ['search', 'find', 'book', 'author', 'category', 'show me', 'list', 'read', 'recommend'];
    let cleanQuery = query;
    isSearchKeywords.forEach(kw => {
        cleanQuery = cleanQuery.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
    });
    cleanQuery = cleanQuery.replace(/books?/gi, '').replace(/\bfor\b/gi, '').replace(/\babout\b/gi, '').replace(/\bof\b/gi, '').replace(/\bthe\b/gi, '').replace(/\ba\b/gi, '').replace(/\ban\b/gi, '').trim();

    // Use original message if clean query becomes too short
    const searchTerms = cleanQuery.length > 1 ? cleanQuery : query;

    try {
        const searchRegex = new RegExp(searchTerms, 'i');
        const books = await Book.find({
            $or: [
                { title: searchRegex },
                { author: searchRegex },
                { category: searchRegex }
            ]
        }).limit(5).select('title author category availableCopies');

        if (books.length > 0) {
            const bookList = books.map(b => `- "${b.title}" by ${b.author} (${b.category}) - ${b.availableCopies > 0 ? b.availableCopies + ' copies available' : 'Checked out'}`).join('\n');
            return `I searched the catalog for "${searchTerms}" and found:\n${bookList}\n\n*(Note: Configure a valid GEMINI_API_KEY in the backend .env file to enable the smart AI librarian!)*`;
        }
    } catch (e) {
        console.error("Local search error", e);
    }

    return "I am currently running in offline helper mode. I can assist with library hours, policies, or book searches. For full conversational AI capability, please configure a valid GEMINI_API_KEY in the backend `.env` file.";
};

// Local offline helper for recommendations
const handleLocalRecommendations = async (userId) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(userId).populate('borrowedBooks', 'title author category');

        // Suggest some popular books in the library
        const popularBooks = await Book.find().limit(3).select('title author category');

        let bookList = "";
        if (popularBooks.length > 0) {
            bookList = popularBooks.map(b => `<li><strong>${b.title}</strong> by ${b.author} (${b.category})</li>`).join('\n');
        } else {
            bookList = "<li>No books available in the catalog yet.</li>";
        }

        return `
            <p>Here are some recommended books from our catalog:</p>
            <ul>
                ${bookList}
            </ul>
            <p><small><em>(Offline Mode: Configure GEMINI_API_KEY in backend .env for AI recommendations based on your borrow history)</em></small></p>
        `;
    } catch (e) {
        console.error("Local recommendations error", e);
        return `<p>Failed to load recommendations. Please try again later.</p>`;
    }
};

exports.handleQuery = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
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

        // Check if Gemini API key is missing or is the default placeholder
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key') {
            const fallbackReply = await handleLocalFallback(message, userContext);
            return res.json({ success: true, reply: fallbackReply });
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
            return res.json({
                success: true,
                reply: aiResponse
            });

        } catch (apiErr) {
            console.error('Gemini API call failed, using local fallback:', apiErr);
            const fallbackReply = await handleLocalFallback(message, userContext);
            return res.json({ success: true, reply: fallbackReply });
        }

    } catch (error) {
        console.error('Chatbot Controller Error:', error);
        res.status(500).json({ success: false, message: 'Sorry, I am having trouble connecting to my knowledge base right now.', error: error.message });
    }
};

exports.getRecommendations = async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key') {
            const localRecs = await handleLocalRecommendations(req.user.id);
            return res.status(200).json({ success: true, data: localRecs });
        }

        try {
            const User = require('../models/User');
            const user = await User.findById(req.user.id).populate('borrowedBooks', 'title author category');

            let prompt = `You are a helpful virtual librarian. The user "${user.name}" wants book recommendations. `;
            
            if (user.borrowedBooks && user.borrowedBooks.length > 0) {
                const history = user.borrowedBooks.map(b => `${b.title} by ${b.author} (${b.category})`).join(', ');
                prompt += `They have previously borrowed these books: ${history}. Based on this, suggest 3 new books they might like that exist in a typical college library. Format as a clean HTML unordered list (<ul><li>...</li></ul>) without any markdown code blocks. Give a brief 1-sentence reason for each.`;
            } else {
                prompt += `They haven't borrowed any books yet. Suggest 3 highly rated, popular books for a college student (mix of technology, science, and self-help). Format as a clean HTML unordered list (<ul><li>...</li></ul>) without any markdown code blocks. Give a brief 1-sentence reason for each.`;
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const result = await model.generateContent(prompt);
            let recommendations = result.response.text();
            
            // Clean up possible markdown code blocks around HTML
            recommendations = recommendations.replace(/```html/g, '').replace(/```/g, '').trim();
            
            return res.status(200).json({
                success: true,
                data: recommendations
            });

        } catch (apiErr) {
            console.error('Gemini recommendations call failed, using local fallback:', apiErr);
            const localRecs = await handleLocalRecommendations(req.user.id);
            return res.status(200).json({ success: true, data: localRecs });
        }

    } catch (error) {
        console.error('Recommendation Error:', error);
        res.status(500).json({ success: false, message: 'Failed to get recommendations' });
    }
};

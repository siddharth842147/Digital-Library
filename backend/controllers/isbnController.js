const fetch = require('node-fetch');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const BookLookup = require('../models/BookLookup');
const Book = require('../models/Book');
const { toIsbn13 } = require('../utils/isbn');

// TTL for cache (in ms) — 30 days
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;

const normalizeOpenLibraryData = (info, isbn13) => {
    if (!info) return null;
    return {
        title: info.title || info.title_suggest || '',
        author: (info.authors && info.authors[0] && info.authors[0].name) || (info.author_name && info.author_name[0]) || '',
        publisher: (info.publishers && info.publishers[0] && info.publishers[0].name) || (info.publisher && info.publisher[0]) || '',
        publishedYear: info.publishedYear ? (parseInt(info.publishedYear.toString().match(/\d{4}/)?.[0]) || new Date().getFullYear()) : (info.publish_date ? (parseInt(info.publish_date.match(/\d{4}/)?.[0]) || new Date().getFullYear()) : (info.first_publish_year || new Date().getFullYear())),
        pages: info.number_of_pages || info.number_of_pages_maybe || '',
        coverImage: (info.cover && (info.cover.large || info.cover.medium || info.cover.small)) || (info.cover_i ? `https://covers.openlibrary.org/b/id/${info.cover_i}-L.jpg` : `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`),
        description: typeof info.description === 'string' ? info.description : (info.description?.value || info.notes || ''),
        category: (info.subjects && info.subjects[0]?.name) || '',
        isbn: isbn13
    };
};

const normalizeGoogleBooksData = (info, isbn13) => {
    if (!info || !info.volumeInfo) return null;
    const v = info.volumeInfo;
    return {
        title: v.title || '',
        author: (v.authors && v.authors[0]) || '',
        publisher: v.publisher || '',
        publishedYear: v.publishedDate ? (parseInt(v.publishedDate.match(/\d{4}/)?.[0]) || new Date().getFullYear()) : new Date().getFullYear(),
        pages: v.pageCount || '',
        coverImage: (v.imageLinks && (v.imageLinks.extraLarge || v.imageLinks.large || v.imageLinks.medium || v.imageLinks.thumbnail)) || `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
        description: v.description || '',
        category: (v.categories && v.categories[0]) || '',
        isbn: isbn13
    };
};

/**
 * Intelligent AI metadata fetcher using Gemini
 * Can enrich an existing partial book or identify unknown ISBN from scratch
 */
const fetchGeminiBookMetadata = async (isbn13, existingData = null) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key') return null;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

        let prompt;
        if (existingData && existingData.title && existingData.author) {
            prompt = `You are a professional library cataloging AI. 
Book Title: "${existingData.title}"
Author: "${existingData.author}"
ISBN: "${isbn13}"

Please provide a detailed, engaging, and professional 2-4 sentence summary/description for this book.
Also suggest the standard library Category (e.g. Computers, Science, Fiction, Business, Mathematics, Technology, Engineering, Literature), Publisher, and Pages.

Return ONLY a valid JSON object without markdown formatting or backticks:
{
  "description": "...",
  "category": "...",
  "publisher": "...",
  "pages": 0
}`;
        } else {
            prompt = `You are an automated central library cataloging AI.
Identify the book with ISBN "${isbn13}".
Return ONLY a valid JSON object without markdown formatting or backticks with these exact keys:
{
  "title": "Full Book Title",
  "author": "Author Full Name",
  "description": "Detailed 2-4 sentence summary of the book content and significance",
  "publisher": "Publishing Company",
  "publishedYear": 2020,
  "category": "Standard Library Category (Computers, Engineering, Fiction, Business, Mathematics, Science, Literature)",
  "pages": 350
}`;
        }

        const res = await model.generateContent(prompt);
        let rawText = res.response.text().trim();
        rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

        const parsed = JSON.parse(rawText);
        return parsed;
    } catch (err) {
        console.warn('Gemini Book Lookup Warning:', err.message);
        return null;
    }
};

exports.lookupISBN = async (req, res) => {
    try {
        const raw = req.params.isbn;
        const isbn13 = toIsbn13(raw);
        if (!isbn13) return res.status(400).json({ success: false, message: 'Invalid ISBN' });

        // 0. Check local database first
        const localBook = await Book.findOne({ isbn: { $in: [raw, isbn13] } });
        if (localBook) {
            const localData = {
                title: typeof localBook.title === 'string' ? localBook.title : (localBook.title?.en || localBook.title || ''),
                author: typeof localBook.author === 'string' ? localBook.author : (localBook.author?.en || localBook.author || ''),
                publisher: localBook.publisher || '',
                publishedYear: localBook.publishedYear || new Date().getFullYear(),
                pages: localBook.pages || '',
                coverImage: localBook.coverImage || '',
                description: typeof localBook.description === 'string' ? localBook.description : (localBook.description?.en || localBook.description || ''),
                category: typeof localBook.category === 'string' ? localBook.category : (localBook.category?.en || localBook.category || ''),
                isbn: localBook.isbn
            };
            return res.status(200).json({ success: true, source: 'local_database', data: localData });
        }

        // 1. Check cache (only use if description is present)
        const cached = await BookLookup.findOne({ isbn13 });
        if (cached && (Date.now() - new Date(cached.fetchedAt).getTime()) < CACHE_TTL && cached.data?.description) {
            return res.status(200).json({ success: true, source: 'cache', data: cached.data });
        }

        let result = null;
        let source = '';

        // 2. Try Google Books
        try {
            const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`);
            const gbJson = await gbRes.json();
            if (gbJson && gbJson.totalItems > 0 && gbJson.items && gbJson.items[0]) {
                result = normalizeGoogleBooksData(gbJson.items[0], isbn13);
                source = 'googlebooks';
            }
        } catch (err) {
            console.warn('Google Books fallback notice:', err.message);
        }

        // 3. Try Open Library if Google Books failed or returned empty
        if (!result) {
            try {
                const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`);
                const olJson = await olRes.json();
                const key = `ISBN:${isbn13}`;
                if (olJson && olJson[key]) {
                    result = normalizeOpenLibraryData(olJson[key], isbn13);
                    source = 'openlibrary';
                } else {
                    const s = await fetch(`https://openlibrary.org/search.json?isbn=${isbn13}`);
                    const sj = await s.json();
                    if (sj && sj.docs && sj.docs.length > 0) {
                        result = normalizeOpenLibraryData(sj.docs[0], isbn13);
                        source = 'openlibrary_search';
                    }
                }
            } catch (err) {
                console.warn('Open Library fallback notice:', err.message);
            }
        }

        // 4. AI-Powered Enrichment / Discovery
        // Scenario A: Book found, but missing description or category
        if (result && (!result.description || result.description.length < 20 || !result.category)) {
            const aiData = await fetchGeminiBookMetadata(isbn13, result);
            if (aiData) {
                if (!result.description || result.description.length < 20) {
                    result.description = aiData.description || result.description;
                }
                if (!result.category) {
                    result.category = aiData.category || 'General';
                }
                if (!result.publisher && aiData.publisher) {
                    result.publisher = aiData.publisher;
                }
                if (!result.pages && aiData.pages) {
                    result.pages = aiData.pages;
                }
                source += '+gemini_ai';
            }
        }

        // Scenario B: Neither Google Books nor Open Library found the book -> AI direct lookup
        if (!result) {
            const aiData = await fetchGeminiBookMetadata(isbn13, null);
            if (aiData && aiData.title && aiData.author) {
                result = {
                    title: aiData.title,
                    author: aiData.author,
                    description: aiData.description || '',
                    publisher: aiData.publisher || '',
                    publishedYear: aiData.publishedYear || new Date().getFullYear(),
                    category: aiData.category || 'General',
                    pages: aiData.pages || '',
                    coverImage: `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
                    isbn: isbn13
                };
                source = 'gemini_ai';
            }
        }

        if (!result) {
            return res.status(200).json({ success: false, data: null, message: 'No book details found for this ISBN' });
        }

        // Ensure default cover if empty
        if (!result.coverImage) {
            result.coverImage = `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`;
        }

        // Save to cache
        await BookLookup.findOneAndUpdate(
            { isbn13 },
            { data: result, fetchedAt: new Date() },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, source, data: result });
    } catch (err) {
        console.error('ISBN lookup error:', err);
        return res.status(500).json({ success: false, message: 'Lookup failed' });
    }
};

const Resource = require('../models/Resource');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// @desc    Get all resources
// @route   GET /api/resources
// @access  Public
exports.getResources = async (req, res) => {
    try {
        const { branch, semester, type, status } = req.query;
        let query = {};

        if (branch) query.branch = branch;
        if (semester) query.semester = semester;
        if (type) query.type = type;

        // If user is not admin or librarian, only show approved resources
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'librarian')) {
            query.status = 'approved';
        } else if (status) {
            query.status = status;
        }

        const resources = await Resource.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: resources.length,
            data: resources
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single resource
// @route   GET /api/resources/:id
// @access  Public
exports.getResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        res.status(200).json({
            success: true,
            data: resource
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create resource
// @route   POST /api/resources
// @access  Private (Admin/Librarian)
exports.createResource = async (req, res) => {
    try {
        req.body.uploadedBy = req.user.id;

        // Auto approve if uploaded by admin or librarian
        if (req.user.role === 'admin' || req.user.role === 'librarian') {
            req.body.status = 'approved';
        } else {
            req.body.status = 'pending';
        }

        // If file was uploaded via multer, use that path
        if (req.file) {
            req.body.fileUrl = `/uploads/resources/${req.file.filename}`;
            req.body.fileName = req.file.originalname;
        }

        try {
            if (process.env.GEMINI_API_KEY) {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const prompt = `Analyze this academic resource title and description. Return "FLAGGED" if it contains inappropriate, offensive, hateful, or clearly spam non-academic content. Otherwise return "OK". Title: "${req.body.title}", Description: "${req.body.description || ''}"`;
                const result = await model.generateContent(prompt);
                const text = result.response.text().trim();
                if (text.includes("FLAGGED")) {
                    req.body.aiFlagged = true;
                    req.body.status = 'pending'; // Force pending review
                }
            }
        } catch (aiError) {
            console.error('AI Moderation failed:', aiError);
        }

        const resource = await Resource.create(req.body);

        res.status(201).json({
            success: true,
            data: resource
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update resource
// @route   PUT /api/resources/:id
// @access  Private (Admin/Librarian)
exports.updateResource = async (req, res) => {
    try {
        let resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        resource = await Resource.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: resource
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete resource
// @route   DELETE /api/resources/:id
// @access  Private (Admin)
exports.deleteResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        await resource.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Increment download count
// @route   PUT /api/resources/:id/download
// @access  Public
exports.incrementDownload = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        resource.downloadCount += 1;
        await resource.save();

        res.status(200).json({
            success: true,
            data: resource
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update resource status (approve/reject)
// @route   PUT /api/resources/:id/status
// @access  Private (Admin/Librarian)
exports.updateResourceStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        let resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        resource.status = status;
        await resource.save();

        res.status(200).json({
            success: true,
            data: resource
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upvote resource
// @route   POST /api/resources/:id/upvote
// @access  Private
exports.upvoteResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        const userId = req.user.id;
        
        // Toggle upvote
        if (resource.upvotes.includes(userId)) {
            resource.upvotes = resource.upvotes.filter(id => id.toString() !== userId);
        } else {
            resource.upvotes.push(userId);
        }

        await resource.save();

        res.status(200).json({
            success: true,
            data: resource,
            upvoted: resource.upvotes.includes(userId)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

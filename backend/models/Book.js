const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Please provide book title']
    },
    author: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Please provide author name']
    },
    isbn: {
        type: String,
        unique: true,
        sparse: true,
        match: [/^(?:\d{10}|\d{13})$/, 'Please provide a valid ISBN (10 or 13 digits)']
    },
    category: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Please provide category']
    },
    publisher: {
        type: String,
        trim: true,
        maxlength: [100, 'Publisher name cannot be more than 100 characters']
    },
    publishedYear: {
        type: Number,
        min: [1000, 'Invalid year'],
        max: [new Date().getFullYear(), 'Year cannot be in the future']
    },
    language: {
        type: String,
        default: 'English'
    },
    pages: {
        type: Number,
        min: [1, 'Pages must be at least 1']
    },
    description: {
        type: mongoose.Schema.Types.Mixed
    },
    coverImage: {
        type: String,
        default: 'https://placehold.co/300x400/6366f1/ffffff?text=No+Cover'
    },
    totalCopies: {
        type: Number,
        required: [true, 'Please provide total copies'],
        min: [1, 'Total copies must be at least 1'],
        default: 1
    },
    availableCopies: {
        type: Number,
        required: true,
        min: [0, 'Available copies cannot be negative'],
        default: function () {
            return this.totalCopies;
        }
    },
    shelf: {
        type: String,
        trim: true
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'unavailable'],
        default: 'available'
    },
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        }
    }],
    averageRating: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Update status based on available copies
bookSchema.pre('save', function (next) {
    if (this.availableCopies > 0) {
        this.status = 'available';
    } else {
        this.status = 'unavailable';
    }
    next();
});

// Create index for search
bookSchema.index({ title: 'text', author: 'text', category: 'text' });

module.exports = mongoose.model('Book', bookSchema);

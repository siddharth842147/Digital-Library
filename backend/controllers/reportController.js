const Book = require('../models/Book');
const User = require('../models/User');
const Borrow = require('../models/Borrow');
const PDFDocument = require('pdfkit');

// @desc    Generate Inventory Report PDF
// @route   GET /api/reports/inventory
// @access  Private (Admin)
exports.getInventoryReport = async (req, res) => {
    try {
        const books = await Book.find().sort({ title: 1 });

        const doc = new PDFDocument();
        const filename = `Inventory_Report_${Date.now()}.pdf`;

        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        doc.fontSize(20).text('JVIT Digital Library', { align: 'center' });
        doc.fontSize(16).text('Inventory Status Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`);
        doc.moveDown();

        doc.fontSize(14).text('Book Details:', { underline: true });
        doc.moveDown();

        books.forEach((book, index) => {
            doc.fontSize(12).text(`${index + 1}. ${book.title}`);
            doc.fontSize(10).text(`   Author: ${book.author} | ISBN: ${book.isbn}`);
            doc.text(`   Copies: ${book.availableCopies}/${book.totalCopies} | Location: ${book.shelfLocation || 'Main Hall'}`);
            doc.moveDown(0.5);
        });

        doc.end();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Generate Fine Report PDF
// @route   GET /api/reports/fines
// @access  Private (Admin)
exports.getFineReport = async (req, res) => {
    try {
        const studentsWithFines = await User.find({ totalFines: { $gt: 0 } }).sort({ totalFines: -1 });

        const doc = new PDFDocument();
        const filename = `Fine_Report_${Date.now()}.pdf`;

        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        doc.fontSize(20).text('JVIT Digital Library', { align: 'center' });
        doc.fontSize(16).text('Outstanding Fines Report', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`);
        doc.moveDown();

        doc.fontSize(14).text('Students with Outstanding Fines:', { underline: true });
        doc.moveDown();

        let totalFinesSum = 0;
        studentsWithFines.forEach((student, index) => {
            doc.fontSize(12).text(`${index + 1}. ${student.name} (USN: ${student.usn || 'N/A'})`);
            doc.fontSize(10).text(`   Pending Fine: ₹${student.totalFines}`);
            doc.moveDown(0.5);
            totalFinesSum += student.totalFines;
        });

        doc.moveDown();
        doc.fontSize(14).text(`Total Outstanding Fines: ₹${totalFinesSum}`, { bold: true });

        doc.end();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Export data to CSV
// @route   GET /api/reports/export/:type
// @access  Private (Admin)
exports.exportCsv = async (req, res) => {
    try {
        const { type } = req.params;
        let data = [];
        let filename = '';

        if (type === 'inventory') {
            const books = await Book.find().lean();
            data = books.map(b => ({
                Title: `"${(b.title||'').replace(/"/g, '""')}"`,
                Author: `"${(b.author||'').replace(/"/g, '""')}"`,
                ISBN: b.isbn || 'N/A',
                Category: b.category,
                TotalCopies: b.totalCopies,
                AvailableCopies: b.availableCopies,
                Status: b.status
            }));
            filename = 'Inventory_Report.csv';
        } else if (type === 'users') {
            const users = await User.find({ role: 'student' }).lean();
            data = users.map(u => ({
                Name: `"${(u.name||'').replace(/"/g, '""')}"`,
                Email: u.email,
                USN: u.usn || 'N/A',
                Branch: u.branch || 'N/A',
                TotalFines: u.totalFines || 0,
                Coins: u.coins || 0
            }));
            filename = 'Users_Report.csv';
        } else if (type === 'borrows') {
            const borrows = await Borrow.find().populate('user', 'name usn').populate('book', 'title').lean();
            data = borrows.map(b => ({
                UserName: b.user ? `"${(b.user.name||'').replace(/"/g, '""')}"` : 'Unknown',
                USN: b.user?.usn || 'N/A',
                BookTitle: b.book ? `"${(b.book.title||'').replace(/"/g, '""')}"` : 'Unknown',
                BorrowDate: new Date(b.borrowDate).toLocaleDateString(),
                DueDate: new Date(b.dueDate).toLocaleDateString(),
                Status: b.status
            }));
            filename = 'Borrows_Report.csv';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid export type' });
        }

        if (data.length === 0) {
            return res.status(404).json({ success: false, message: 'No data to export' });
        }

        const headers = Object.keys(data[0]).join(',');
        const csv = [
            headers,
            ...data.map(row => Object.values(row).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(csv);

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

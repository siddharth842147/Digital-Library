const cron = require('node-cron');
const Borrow = require('../models/Borrow');
const User = require('../models/User');
const Book = require('../models/Book');
const Holiday = require('../models/Holiday');
const sendEmail = require('../utils/sendEmail');

const runDailyReminderJob = async () => {
    console.log('Running daily library reminder job...');
    try {
        // Find books due in exactly 2 days (range includes tomorrow and the day after tomorrow)
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
        twoDaysFromNow.setHours(23, 59, 59, 999);

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const nearingDue = await Borrow.find({
            status: 'borrowed',
            dueDate: { $gte: tomorrow, $lte: twoDaysFromNow }
        }).populate('user').populate('book');

        for (const borrow of nearingDue) {
            if (borrow.user && borrow.user.email) {
                const bookTitle = borrow.book ? borrow.book.title : 'Deleted Book';
                await sendEmail({
                    email: borrow.user.email,
                    subject: 'Library Reminder: Book Due Soon ⏳',
                    message: `Hello ${borrow.user.name},\n\nThis is a reminder that the book "${bookTitle}" is due for return on ${new Date(borrow.dueDate).toLocaleDateString()}.\n\nPlease return it on time to avoid fines.\n\nBest regards,\nLibrary Team`
                });
            }
        }

        // Check for books that just became overdue today
        const newlyOverdue = await Borrow.find({
            dueDate: { $lt: new Date() },
            status: 'borrowed',
            returnDate: null
        }).populate('user').populate('book');

        if (newlyOverdue.length > 0) {
            console.log(`Found ${newlyOverdue.length} books that just became overdue. Updating status and notifying users...`);
            for (const borrow of newlyOverdue) {
                borrow.status = 'overdue';
                await borrow.save();

                if (borrow.user && borrow.user.email) {
                    const bookTitle = borrow.book ? borrow.book.title : 'Deleted Book';
                    await sendEmail({
                        email: borrow.user.email,
                        subject: 'Library Alert: Book Overdue 🚨',
                        message: `Hello ${borrow.user.name},\n\nYour borrowed book "${bookTitle}" was due for return on ${new Date(borrow.dueDate).toLocaleDateString()}.\n\nIt is now marked as OVERDUE, and you will start accruing fines of ₹10 per day (excluding Sundays/holidays).\n\nPlease return the book immediately to avoid further fines.\n\nBest regards,\nLibrary Team`
                    });
                }
            }
            console.log(`Updated and notified ${newlyOverdue.length} overdue records.`);
        }

    } catch (error) {
        console.error('Error in daily reminder job:', error);
    }
};

const runWeeklyOverdueJob = async () => {
    console.log('Running weekly overdue fine summary job...');
    try {
        const overdue = await Borrow.find({
            status: 'overdue'
        }).populate('user').populate('book');

        for (const borrow of overdue) {
            if (borrow.user && borrow.user.email) {
                // Temporarily set returnDate to current time to calculate what the fine WOULD BE if returned now
                // We don't save this returnDate, just use it for calculation
                const originalReturnDate = borrow.returnDate;
                borrow.returnDate = new Date();
                const currentFine = await borrow.calculateFine();
                borrow.returnDate = originalReturnDate;

                const bookTitle = borrow.book ? borrow.book.title : 'Deleted Book';
                await sendEmail({
                    email: borrow.user.email,
                    subject: 'Weekly Overdue Alert & Fine Summary ⚖️',
                    message: `Hello ${borrow.user.name},\n\nYour borrowed book "${bookTitle}" is currently OVERDUE.\n\nAs of today, your calculated fine for this book is: ₹${currentFine}.\n\nPlease return the book at the earliest to prevent further fine accumulation.\n\nNote: Fines do not count for Sundays, 1st/3rd Saturdays and government holidays.\n\nBest regards,\nLibrary Team`
                });
            }
        }
    } catch (error) {
        console.error('Error in weekly overdue job:', error);
    }
};

const initReminderJob = () => {
    // 1. Daily Due Reminder & Overdue Update
    // Runs every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
        await runDailyReminderJob();
    });

    // 2. Weekly Overdue Fine Summary
    // Runs every Monday at 10:30 AM
    cron.schedule('30 10 * * 1', async () => {
        await runWeeklyOverdueJob();
    });

    // Run immediately on startup in development or production (excluding test environment)
    if (process.env.NODE_ENV !== 'test') {
        console.log('Initializing Automated Reminder Jobs and running startup check...');
        runDailyReminderJob().catch(err => console.error('Startup Daily Job Error:', err));
        runWeeklyOverdueJob().catch(err => console.error('Startup Weekly Job Error:', err));
    }
};

module.exports = { initReminderJob, runDailyReminderJob, runWeeklyOverdueJob };

const mongoose = require('mongoose');
const User = require('./models/User');
const crypto = require('crypto');
require('dotenv').config();

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const testEmail = 'forgot_test@gmail.com';

        // 1. Clean up existing test user if any
        await User.deleteOne({ email: testEmail });

        // 2. Create a test user (must match password complexity validation)
        const user = await User.create({
            name: 'Forgot Test User',
            email: testEmail,
            password: 'Password123!', // Has uppercase, lowercase, and number
            role: 'student',
            phone: '9876543210',
            isVerified: true
        });
        console.log('✅ Created test user:', user.email);

        // 3. Simulate forgotPassword OTP generation
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`🔑 Generated 6-digit OTP: ${otp}`);

        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
        await user.save({ validateBeforeSave: false });
        console.log('✅ Stored hashed OTP in database');

        // 4. Retrieve user from DB and verify fields
        const updatedUser = await User.findOne({ email: testEmail });
        if (!updatedUser.resetPasswordToken || !updatedUser.resetPasswordExpire) {
            throw new Error('❌ Reset token/expiry not found in DB');
        }
        console.log('✅ Retreived reset tokens from DB successfully');

        // 5. Simulate resetPasswordOtp verify & update password
        const inputOtp = otp;
        const newPassword = 'NewPassword789!';

        const hashedInputOtp = crypto
            .createHash('sha256')
            .update(inputOtp)
            .digest('hex');

        const userToReset = await User.findOne({
            email: testEmail,
            resetPasswordToken: hashedInputOtp,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!userToReset) {
            throw new Error('❌ User not found with matching OTP or token expired');
        }
        console.log('✅ Matching user found with valid OTP');

        userToReset.password = newPassword;
        userToReset.resetPasswordToken = undefined;
        userToReset.resetPasswordExpire = undefined;
        await userToReset.save();
        console.log('✅ Password successfully updated');

        // 6. Verify password match
        const finalUser = await User.findOne({ email: testEmail }).select('+password');
        const isMatch = await finalUser.matchPassword(newPassword);
        if (!isMatch) {
            throw new Error('❌ New password does not match or login failed');
        }
        console.log('✅ Password comparison check passed successfully!');

        // 7. Clean up
        await User.deleteOne({ email: testEmail });
        console.log('✅ Cleaned up test user');

        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err.message);
        process.exit(1);
    }
}

runTest();

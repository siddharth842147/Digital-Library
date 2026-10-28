/**
 * Automated Verification Script for Account Lockout & Failed-Login Protection
 * Tests all 5 requirements:
 *   a. Attempts 1-5 with wrong password return generic "Invalid email or password"
 *   b. Attempt 5 triggers lockout, next attempt returns HTTP 423 Locked
 *   c. Correct password during lock is still rejected (HTTP 423)
 *   d. After lock expires, login works again (HTTP 200)
 *   e. Successful login resets counter to 0 and lockUntil to null
 *   + Admin unlock functionality
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/.env' });

const User = require('./models/User');
const authController = require('./controllers/authController');

// Mock Express req, res
function createMockReqRes(body = {}, params = {}) {
    const req = {
        body,
        params,
        headers: {},
        cookies: {}
    };

    let statusCode = 200;
    let responseData = null;
    let cookieList = {};

    const res = {
        status: function (code) {
            statusCode = code;
            return this;
        },
        json: function (data) {
            responseData = data;
            return this;
        },
        cookie: function (name, value, options) {
            cookieList[name] = { value, options };
            return this;
        },
        getStatusCode: () => statusCode,
        getData: () => responseData,
        getCookies: () => cookieList
    };

    return { req, res };
}

async function runLockoutTests() {
    console.log('====================================================');
    console.log('  ACCOUNT LOCKOUT & FAILED LOGIN VERIFICATION SUITE  ');
    console.log('====================================================\n');

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/library_management';
    console.log(`[Setup] Connecting to MongoDB: ${mongoUri}`);

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully.\n');

    const TEST_EMAIL = 'lockout.tester@gmail.com';
    const CORRECT_PASSWORD = 'CorrectPassword123';
    const WRONG_PASSWORD = 'WrongPassword123';

    try {
        // Reset/Create Test User
        await User.deleteOne({ email: TEST_EMAIL });

        const testUser = await User.create({
            name: 'Lockout Tester',
            email: TEST_EMAIL,
            password: CORRECT_PASSWORD,
            role: 'student',
            isVerified: true
        });

        console.log(`[Setup] Created test user: ${TEST_EMAIL}`);
        console.log(`  Initial failedLoginAttempts: ${testUser.failedLoginAttempts}`);
        console.log(`  Initial lockUntil: ${testUser.lockUntil}\n`);

        // ====================================================================
        // Test A: Attempts 1-4 with wrong password return 401; Attempt 5 locks
        // ====================================================================
        console.log('--- TEST A: Failed Login Attempts (1 through 5) ---');
        for (let attempt = 1; attempt <= 4; attempt++) {
            const { req, res } = createMockReqRes({
                email: TEST_EMAIL,
                password: WRONG_PASSWORD
            });

            await authController.login(req, res);
            const status = res.getStatusCode();
            const data = res.getData();

            console.log(`  Attempt ${attempt}: HTTP ${status} | message: "${data.message}" | warning: "${data.warning || 'none'}"`);

            if (status !== 401) {
                throw new Error(`Attempt ${attempt} expected HTTP 401, got ${status}`);
            }
            if (data.message !== 'Invalid email or password') {
                throw new Error(`Attempt ${attempt} expected generic message 'Invalid email or password', got '${data.message}'`);
            }
            if (attempt >= 3 && !data.warning) {
                throw new Error(`Attempt ${attempt} expected warning message, but got none`);
            }
        }

        // Attempt 5 (Threshold Trigger)
        const { req: req5, res: res5 } = createMockReqRes({
            email: TEST_EMAIL,
            password: WRONG_PASSWORD
        });
        await authController.login(req5, res5);
        const status5 = res5.getStatusCode();
        const data5 = res5.getData();

        console.log(`  Attempt 5 (Trigger Lock): HTTP ${status5} | locked: ${data5.locked} | message: "${data5.message}"`);

        if (status5 !== 423) {
            throw new Error(`Attempt 5 expected HTTP 423 (Locked), got ${status5}`);
        }
        if (!data5.locked || !data5.lockUntil) {
            throw new Error('Attempt 5 response missing locked flag or lockUntil timestamp');
        }
        console.log('✅ PASS: Attempts 1-4 returned 401 with generic error; attempt 5 locked account with HTTP 423.\n');

        // ====================================================================
        // Test B: Attempt 6 while locked returns HTTP 423 immediately
        // ====================================================================
        console.log('--- TEST B: Subsequent Attempt While Locked ---');
        const { req: req6, res: res6 } = createMockReqRes({
            email: TEST_EMAIL,
            password: WRONG_PASSWORD
        });
        await authController.login(req6, res6);
        const status6 = res6.getStatusCode();
        const data6 = res6.getData();

        console.log(`  Attempt 6: HTTP ${status6} | locked: ${data6.locked} | remainingMinutes: ${data6.remainingMinutes}`);

        if (status6 !== 423) {
            throw new Error(`Attempt 6 expected HTTP 423, got ${status6}`);
        }
        console.log('✅ PASS: Locked account immediately rejected with HTTP 423.\n');

        // ====================================================================
        // Test C: Correct password during lockout is STILL rejected with 423
        // ====================================================================
        console.log('--- TEST C: Correct Password During Lockout ---');
        const { req: reqC, res: resC } = createMockReqRes({
            email: TEST_EMAIL,
            password: CORRECT_PASSWORD
        });
        await authController.login(reqC, resC);
        const statusC = resC.getStatusCode();
        const dataC = resC.getData();

        console.log(`  Correct Password Attempt: HTTP ${statusC} | locked: ${dataC.locked} | message: "${dataC.message}"`);

        if (statusC !== 423) {
            throw new Error(`Correct password during lock expected HTTP 423, got ${statusC}! Password comparison must not bypass lock.`);
        }
        console.log('✅ PASS: Correct password rejected during lock; bcrypt comparison bypassed for security.\n');

        // ====================================================================
        // Test D: After lock expires, login works again
        // ====================================================================
        console.log('--- TEST D: Automatic Unlock After Lock Expiration ---');
        // Simulate expired lock by setting lockUntil to 5 seconds in the past
        await User.updateOne(
            { email: TEST_EMAIL },
            { $set: { lockUntil: new Date(Date.now() - 5000) } }
        );
        console.log('  Simulated lock expiration (lockUntil set to past).');

        const { req: reqD, res: resD } = createMockReqRes({
            email: TEST_EMAIL,
            password: CORRECT_PASSWORD
        });
        await authController.login(reqD, resD);
        const statusD = resD.getStatusCode();
        const dataD = resD.getData();

        console.log(`  Login Attempt: HTTP ${statusD} | success: ${dataD.success} | token issued: ${!!dataD.token}`);

        if (statusD !== 200 || !dataD.success) {
            throw new Error(`Expired lock login expected HTTP 200, got ${statusD}`);
        }
        console.log('✅ PASS: Login succeeds after lock expiration.\n');

        // ====================================================================
        // Test E: Successful login resets counter and lockUntil
        // ====================================================================
        console.log('--- TEST E: Counter Reset On Successful Login ---');
        const refreshedUser = await User.findOne({ email: TEST_EMAIL });
        console.log(`  failedLoginAttempts in DB: ${refreshedUser.failedLoginAttempts}`);
        console.log(`  lockUntil in DB: ${refreshedUser.lockUntil}`);

        if (refreshedUser.failedLoginAttempts !== 0) {
            throw new Error(`Expected failedLoginAttempts to be 0, got ${refreshedUser.failedLoginAttempts}`);
        }
        if (refreshedUser.lockUntil !== null) {
            throw new Error(`Expected lockUntil to be null, got ${refreshedUser.lockUntil}`);
        }
        console.log('✅ PASS: Successful login resets failedLoginAttempts to 0 and lockUntil to null.\n');

        // ====================================================================
        // Test F: Admin Manual Unlock Endpoint
        // ====================================================================
        console.log('--- TEST F: Admin / Librarian Manual Unlock ---');
        // Lock user again
        await User.updateOne(
            { email: TEST_EMAIL },
            { $set: { failedLoginAttempts: 0, lockUntil: new Date(Date.now() + 15 * 60 * 1000) } }
        );
        console.log('  User locked manually for admin unlock test.');

        const { req: reqUnlock, res: resUnlock } = createMockReqRes({}, { userId: testUser._id.toString() });
        await authController.unlockUser(reqUnlock, resUnlock);

        console.log(`  Admin Unlock: HTTP ${resUnlock.getStatusCode()} | message: "${resUnlock.getData().message}"`);

        if (resUnlock.getStatusCode() !== 200) {
            throw new Error(`Admin unlock expected HTTP 200, got ${resUnlock.getStatusCode()}`);
        }

        const unlockedUser = await User.findById(testUser._id);
        if (unlockedUser.lockUntil !== null || unlockedUser.failedLoginAttempts !== 0) {
            throw new Error('Admin unlock failed to clear lock state');
        }

        // Verify user can now log in
        const { req: reqAfterUnlock, res: resAfterUnlock } = createMockReqRes({
            email: TEST_EMAIL,
            password: CORRECT_PASSWORD
        });
        await authController.login(reqAfterUnlock, resAfterUnlock);
        if (resAfterUnlock.getStatusCode() !== 200) {
            throw new Error(`Login after admin unlock expected HTTP 200, got ${resAfterUnlock.getStatusCode()}`);
        }
        console.log('✅ PASS: Admin unlock successfully unlocked user and restored login access.\n');

        // Cleanup
        await User.deleteOne({ email: TEST_EMAIL });
        console.log('=== ALL 6 TESTS (A through F) PASSED WITH 100% SUCCESS! ===\n');

    } catch (err) {
        console.error('\n❌ TEST FAILURE:', err.message);
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
    }
}

runLockoutTests();


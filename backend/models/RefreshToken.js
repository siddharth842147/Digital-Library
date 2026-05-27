const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isRevoked: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

RefreshTokenSchema.statics.createToken = async function (user) {
    const crypto = require('crypto');
    const expiredAt = new Date();

    // Set expiration to 7 days
    expiredAt.setDate(expiredAt.getDate() + 7);

    const token = crypto.randomBytes(40).toString('hex');

    const refreshToken = new this({
        token,
        user: user._id,
        expiryDate: expiredAt.getTime(),
    });

    await refreshToken.save();
    return refreshToken.token;
};

RefreshTokenSchema.statics.verifyExpiration = (token) => {
    return token.expiryDate.getTime() < new Date().getTime();
};

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);

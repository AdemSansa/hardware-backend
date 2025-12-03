const mongoose = require("mongoose");
const bcrypt = require('bcrypt');


const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  roles: { type: [String], default: ['user'] },
  isVerified: { type: Boolean, default: false },
  refreshTokens: [{ token: String, createdAt: Date }], // store hashed refresh tokens optionally
  passwordResetToken: String,
  passwordResetExpires: Date,
  verifyEmailToken: String,
  isOnline: { type: Boolean, default: false },
  lastOnline: { type: Date, default: Date.now },
}, { timestamps: true });


userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  });
  userSchema.methods.comparePassword = function(plain) {
    return bcrypt.compare(plain, this.password);
  };
  
  module.exports = mongoose.model('User', userSchema);
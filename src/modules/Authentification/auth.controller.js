const crypto = require('crypto');
const User = require('../user/user.schema');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/tokens');
const { validationResult } = require('express-validator');
const sendEmail = require('../../utils/email'); // simple nodemailer helper
const { markUserOnline, markUserOffline } = require('../../services/statusTracker');



const register = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        console.log(req.body);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const verifyToken = crypto.randomBytes(32).toString('hex');
        const user = await User.create({ name: fullName, email, password, verifyEmailToken: verifyToken });
        await user.save();

        // Ensure FRONTEND_URL ends with / if not already
        const frontendUrl = process.env.FRONTEND_URL?.endsWith('/') 
            ? process.env.FRONTEND_URL 
            : `${process.env.FRONTEND_URL}/`;
        const verifyLink = `${frontendUrl}auth/verify-email?token=${verifyToken}`;

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5e6d3;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5e6d3; padding: 20px;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #f5e6d3 0%, #e8d5b7 50%, #d4c4a8 100%); border-radius: 12px 12px 0 0;">
                            <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                                <span style="font-size: 36px;">🔧</span>
                                <h1 style="margin: 0; color: #8b6f47; font-size: 28px; font-weight: 600;">Hardware Store</h1>
                            </div>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #5a4a3a; font-size: 24px; font-weight: 600;">Welcome, ${fullName}!</h2>
                            <p style="margin: 0 0 20px; color: #6b5d4f; font-size: 16px; line-height: 1.6;">
                                Thank you for creating an account with us. To complete your registration and start shopping, please verify your email address by clicking the button below.
                            </p>
                            <p style="margin: 0 0 30px; color: #6b5d4f; font-size: 16px; line-height: 1.6;">
                                This verification link will expire in 24 hours for security reasons.
                            </p>
                            <!-- Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${verifyLink}" style="display: inline-block; padding: 14px 32px; background-color: #b8860b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(184, 134, 11, 0.3);">
                                            Verify Email Address
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <!-- Alternative Link -->
                            <p style="margin: 30px 0 0; color: #999; font-size: 14px; line-height: 1.6;">
                                If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 10px 0 0; word-break: break-all;">
                                <a href="${verifyLink}" style="color: #b8860b; text-decoration: underline; font-size: 14px;">${verifyLink}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e8d5b7;">
                            <p style="margin: 0 0 10px; color: #6b5d4f; font-size: 14px; line-height: 1.6;">
                                If you didn't create an account with us, please ignore this email.
                            </p>
                            <p style="margin: 0; color: #999; font-size: 12px;">
                                © ${new Date().getFullYear()} Hardware Store. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await sendEmail(email, 'Verify your email address - Hardware Store', emailHtml);
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
};

const verifyEmail = async (req, res) => {

    const {token } = req.query;
    console.log(token);
    const user = await User.findOne({verifyEmailToken: token });
  if (!user) return res.status(400).json({ message: 'Invalid token' });
  user.isVerified = true;
  user.verifyEmailToken = undefined;
  await user.save();
  res.json({ message: 'Email verified' });

};



const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    
        const ok = await user.comparePassword(password);
        if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    
        if (!user.isVerified) {
          return res.status(403).json({ message: 'Please verify your email first' });
        }
    
        const payload = { sub: user._id.toString(), roles: user.roles , raw: user};
    
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
    
        // store refresh token (you should hash it before storing in production)
        user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
        await user.save();
    
        // set httpOnly cookie for refresh token (optional)
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7d
        });
    
        // Mark user as online
        await markUserOnline(user._id.toString());
    
        res.json({ accessToken, expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
      }
    };
    


const refreshToken = async (req, res) => {
    try {
        // get from cookie or body
        const token = req.cookies?.refreshToken || req.body.refreshToken;
        if (!token) return res.status(401).json({ message: 'No refresh token' });
    
        let payload;
        try {
          payload = verifyRefreshToken(token);
        } catch (err) {
          return res.status(401).json({ message: 'Invalid refresh token' });
        }
    
        const user = await User.findById(payload.sub);
        if (!user) return res.status(401).json({ message: 'Invalid user' });
    
        // check token exists in DB
        const found = user.refreshTokens.find(rt => rt.token === token);
        if (!found) return res.status(401).json({ message: 'Refresh token revoked' });
    
        // rotate: remove used token and add a new one
        user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== token);
        const newRefreshToken = signRefreshToken({ sub: user._id.toString(), roles: user.roles });
        user.refreshTokens.push({ token: newRefreshToken, createdAt: new Date() });
        await user.save();
    
        const newAccess = signAccessToken({ sub: user._id.toString(), roles: user.roles });
    
        // set cookie
        res.cookie('refreshToken', newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
    
        res.json({ accessToken: newAccess, expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
      }
    };


const logout = async (req, res) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) return res.status(204).send();
    try {
      // remove token from DB
      const payload = verifyRefreshToken(token);
      const user = await User.findById(payload.sub);
      if (user) {
        user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== token);
        await user.save();
        // Mark user as offline
        await markUserOffline(user._id.toString());
      }
      res.clearCookie('refreshToken');
      res.status(204).send();
    } catch (err) {
      res.clearCookie('refreshToken');
      res.status(204).send();
    }
  };


const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, we\'ve sent a password reset link.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Ensure FRONTEND_URL ends with / if not already
    const frontendUrl = process.env.FRONTEND_URL?.endsWith('/') 
        ? process.env.FRONTEND_URL 
        : `${process.env.FRONTEND_URL}/`;
    const resetLink = `${frontendUrl}auth/reset-password?token=${resetToken}`;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5e6d3;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5e6d3; padding: 20px;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #f5e6d3 0%, #e8d5b7 50%, #d4c4a8 100%); border-radius: 12px 12px 0 0;">
                            <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                                <span style="font-size: 36px;">🔧</span>
                                <h1 style="margin: 0; color: #8b6f47; font-size: 28px; font-weight: 600;">Hardware Store</h1>
                            </div>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #5a4a3a; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                            <p style="margin: 0 0 20px; color: #6b5d4f; font-size: 16px; line-height: 1.6;">
                                We received a request to reset your password. Click the button below to create a new password.
                            </p>
                            <p style="margin: 0 0 30px; color: #6b5d4f; font-size: 16px; line-height: 1.6;">
                                This link will expire in 1 hour for security reasons.
                            </p>
                            <!-- Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #b8860b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(184, 134, 11, 0.3);">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <!-- Alternative Link -->
                            <p style="margin: 30px 0 0; color: #999; font-size: 14px; line-height: 1.6;">
                                If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 10px 0 0; word-break: break-all;">
                                <a href="${resetLink}" style="color: #b8860b; text-decoration: underline; font-size: 14px;">${resetLink}</a>
                            </p>
                            <p style="margin: 30px 0 0; color: #999; font-size: 14px; line-height: 1.6;">
                                If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #fafafa; border-radius: 0 0 12px 12px; border-top: 1px solid #e8d5b7;">
                            <p style="margin: 0; color: #999; font-size: 12px;">
                                © ${new Date().getFullYear()} Hardware Store. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    await sendEmail(email, 'Reset your password - Hardware Store', emailHtml);
    res.json({ message: 'If that email exists, we\'ve sent a password reset link.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { register, verifyEmail, login, logout, refreshToken, forgotPassword, resetPassword };

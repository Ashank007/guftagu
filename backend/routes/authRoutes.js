import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import sendEmail from '../utils/sendEmail.js';
import { protect } from '../middleware/authMiddleware.js';
import generateOtpEmailHTML from '../utils/otpEmailTemplate.js'; 
import generateResetEmailHTML from '../utils/resetEmailTemplate.js'; 

const router = express.Router();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!/^[a-zA-Z0-9._%+-]+@mietjammu\.in$/.test(email)) {
        return res.status(400).json({ message: 'Only @mietjammu.in emails are allowed' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'Email already registered' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.deleteMany({ email });
    const otp = new Otp({ email, otp: otpCode });
    await otp.save();

    try {
        const otpHTML = generateOtpEmailHTML(otpCode);
        const fallbackText = `Your Guftagu OTP is: ${otpCode}`;
        await sendEmail(email, 'Guftagu - Email Verification OTP', fallbackText, otpHTML);
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending OTP' });
    }
});

router.post('/register', async (req, res) => {
    const { email, otp, password, fullName, year, sex, profilePicture } = req.body;

    const otpEntry = await Otp.findOne({ email });
    if (!otpEntry) {
        return res.status(400).json({ message: 'OTP expired or invalid' });
    }

    const isMatch = await otpEntry.matchOtp(otp);
    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }

    const user = await User.create({
        email,
        password,
        fullName,
        year,
        sex,
        profilePicture: profilePicture || undefined,
        isVerified: true
    });
    
    await Otp.deleteOne({ email });

    if (user) {
        const token = generateToken(user._id);
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        
        res.status(201).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        if (!user.isVerified) {
             return res.status(401).json({ message: 'Please verify your email first' });
        }
         if (user.isSuspended) {
             return res.status(403).json({ message: 'Your account is suspended' });
        }

        const token = generateToken(user._id);
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
        });
    } else {
        res.status(401).json({ message: 'Invalid email or password' });
    }
});

router.get('/me', protect, (req, res) => {
  if (req.user) {
    res.json({
      _id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      profilePicture: req.user.profilePicture,
      isAdmin: req.user.isAdmin
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

router.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: true, 
    sameSite: 'none',
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();
    const resetUrl = `${process.env.FRONTEND_URI}/reset-password/${resetToken}`;
    const resetHTML = generateResetEmailHTML(resetUrl);
    const fallbackText = `Click here to reset your password: ${resetUrl}`;

    try {
        await sendEmail(user.email, 'Guftagu - Password Reset Request', fallbackText, resetHTML);
        res.status(200).json({ message: 'Email sent' });
    } catch (error) {
        console.error(error);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(500).json({ message: 'Email could not be sent' });
    }
});

router.put('/reset-password/:token', async (req, res) => {
    const { password } = req.body;

    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
});

export default router;
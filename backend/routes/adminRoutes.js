import express from 'express';
import { adminProtect } from '../middleware/adminMiddleware.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

// @desc    Get all users (for admin panel)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', adminProtect, async (req, res) => {
    try {
        const users = await User.aggregate([
            {
                $project: { // Select fields and calculate counts safely
                    _id: 1,
                    fullName: 1,
                    email: 1,
                    isSuspended: 1,
                    isAdmin: 1,
                    // Use $ifNull to provide default empty array if field is missing
                    blockedUsersCount: { $size: { $ifNull: ["$blockedUsers", []] } },
                    reportsCount: { $size: { $ifNull: ["$reports", []] } },
                    createdAt: 1
                }
            }
        ]);
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: 'Server Error fetching users' });
    }
});
router.get('/users/:id/details', adminProtect, async (req, res) => {
    try {
        const userId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
             return res.status(400).json({ message: 'Invalid User ID format' });
        }

        // Find the user and populate reports and blocked lists
        const user = await User.findById(userId)
            .select('-password') // Exclude password
            .populate('reports.reporter', 'fullName email _id') // Populate reporter details
            .populate('blockedUsers', 'fullName email _id'); // Populate blocked user details

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Find users who have blocked this user
        const blockedByUsers = await User.find({ blockedUsers: userId }).select('fullName email _id'); // Select details of blockers
        res.json({
            userDetails: user,
            blockedBy: blockedByUsers
        });

    } catch (error) {
        console.error(`Error fetching details for user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server Error fetching user details' });
    }
});

router.delete('/users/:userId/reports/:reportId', adminProtect, async (req, res) => {
     try {
        const { userId, reportId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(reportId)) {
             return res.status(400).json({ message: 'Invalid User ID or Report ID format' });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Find the index of the report to remove
        const reportIndex = user.reports.findIndex(report => report._id.equals(reportId));

        if (reportIndex === -1) {
            return res.status(404).json({ message: 'Report not found for this user' });
        }

        // Remove the report using splice
        user.reports.splice(reportIndex, 1);

        // Re-evaluate suspension (optional, depends if you want removal to potentially unsuspend)
        if (user.reports.length < 3 && user.isSuspended) {
             user.isSuspended = false; // Example: Auto-unsuspend if reports drop
        }

        await user.save();

        res.json({ message: 'Report removed successfully', reportsCount: user.reports.length, isSuspended: user.isSuspended });

    } catch (error) {
        console.error(`Error removing report ${req.params.reportId} for user ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Server Error removing report' });
    }
});


// @desc    Unsuspend a user
// @route   PUT /api/admin/users/:id/unsuspend
// @access  Private/Admin
router.put('/users/:id/unsuspend', adminProtect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.isSuspended = false;
            user.reports = []; // Optionally clear reports when unsuspending
            await user.save();
            res.json({ message: 'User unsuspended successfully', user: { _id: user._id, fullName: user.fullName, isSuspended: user.isSuspended } });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error unsuspending user' });
    }
});

// @desc    Clear all blocks for a user
// @route   PUT /api/admin/users/:id/clear-blocks
// @access  Private/Admin
router.put('/users/:id/clear-blocks', adminProtect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.blockedUsers = []; // Clear the blocked users array
            await user.save();
            res.json({ message: 'User blocks cleared successfully', user: { _id: user._id, fullName: user.fullName, blockedUsers: user.blockedUsers } });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error clearing blocks' });
    }
});


// Add more admin routes here later (e.g., delete user, view reports)

export default router;
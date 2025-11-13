import express from 'express';
import multer from 'multer';
import { storage, cloudinary } from '../config/cloudinary.js';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();
const upload = multer({ storage });

router.put(
    '/profile',
    protect,
    upload.single('profilePicture'), 
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }
            const user = await User.findById(req.user.id);
            if (user) {
                const oldImageUrl = user.profilePicture; // 1. Purana URL save karo
                user.profilePicture = req.file.path; // 2. Naya URL set karo
                await user.save(); // 3. User ko save karo

                // 4. Purani image delete karo
                try {
                    if (oldImageUrl && oldImageUrl !== '/default-avatar.png' && oldImageUrl.includes('cloudinary')) {
                        const oldPublicId = oldImageUrl.split('/').slice(-2).join('/').split('.').slice(0, -1).join('.');
                        
                        await cloudinary.uploader.destroy(oldPublicId);
                        console.log('Successfully deleted old image:', oldPublicId);
                    }
                } catch (deleteError) {
                    console.error('Failed to delete old image:', deleteError);
                }
                
                res.json({
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    profilePicture: user.profilePicture,
                });
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server Error' });
        }
    }
);
export default router;
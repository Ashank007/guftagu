import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[a-zA-Z0-9._%+-]+@mietjammu\.in$/.test(v);
            },
            message: props => `${props.value} is not a valid MIET email!`
        }
    },
    password: {
        type: String,
        required: true,
    },
    isAdmin: {
            type: Boolean,
            default: false
    },
    fullName: {
        type: String,
        required: true,
    },
    year: {
        type: String,
        enum: ['1st', '2nd', '3rd', '4th'],
        required: true,
    },
    sex: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true,
    },
    profilePicture: {
        type: String,
        default: 'default_avatar_url'
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    reports: [{
            reporter: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            reportedAt: {
                type: Date,
                default: Date.now
            }
    }],
    resetPasswordToken: {
            type: String
    },
    resetPasswordExpires: {
            type: Date
    },
    blockedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
    }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    if (this.reports.length >= 3 && !this.isSuspended) { // Only suspend if not already suspended
      this.isSuspended = true;
      console.log(`User ${this.fullName} automatically suspended due to ${this.reports.length} reports.`);
    } else if (this.reports.length < 3 && this.isSuspended) { // Optional: Unsuspend if reports drop below threshold (manual unban might be better)
      // this.isSuspended = false; 
    }

    next();
});
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
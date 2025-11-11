import { protect } from './authMiddleware.js'; 

const adminProtect = (req, res, next) => {
    protect(req, res, () => {
        if (req.user && req.user.isAdmin) {
            next(); // User is admin, proceed to the route handler
        } else {
            res.status(403); // Forbidden
            throw new Error('Not authorized as an admin');
        }
    });
};

const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        // stack: process.env.NODE_ENV === 'production' ? null : err.stack, // Optional: hide stack in prod
    });
};


export { adminProtect, errorHandler };
const jwt = require('jsonwebtoken');
const db = require('../config/database');
require('dotenv').config();

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the DB and attach to request object
            const [users] = await db.query('SELECT id, role, full_name FROM users WHERE id = ?', [decoded.id]);
            
            if (users.length === 0) {
                 return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            req.user = users[0];
            next();

        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };

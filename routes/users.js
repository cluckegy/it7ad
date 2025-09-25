const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const checkRole = require('../middleware/rbac');

// GET /api/users - Get all users
router.get('/', [authenticateToken, checkRole(['super_admin', 'admin'])], async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, full_name, username, email, role, is_banned FROM users');
        res.json({ users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users/:id - Get a single user's details for editing
router.get('/:id', [authenticateToken, checkRole(['super_admin', 'admin'])], async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, full_name, username, email, role, phone_number, academic_year, country, is_banned, ban_reason FROM users WHERE id = ?', [req.params.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user: users[0] });
    } catch (error) {
        console.error("Error fetching single user:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/users/:id - Update user details
router.put('/:id', [authenticateToken, checkRole(['super_admin', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, username, email, role, phone_number, academic_year, country, is_banned, ban_reason } = req.body;

        const updatedUser = {
            full_name,
            username,
            email,
            role,
            phone_number,
            academic_year,
            country,
            is_banned: is_banned ? 1 : 0,
            ban_reason: is_banned ? ban_reason : null
        };
        
        await db.query('UPDATE users SET ? WHERE id = ?', [updatedUser, id]);
        res.json({ message: 'User updated successfully' });

    } catch (error) {
        console.error("Error updating user:", error);
        // Handle potential duplicate entry errors
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username or email already exists.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;


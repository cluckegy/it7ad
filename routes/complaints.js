const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const checkRole = require('../middleware/rbac'); // Correctly import the middleware function

// GET /api/complaints - Get all complaints (for admins)
router.get('/', [authenticateToken, checkRole(['admin', 'super_admin', 'moderator'])], async (req, res) => {
    try {
        const query = `
            SELECT c.id, c.title, c.category, c.status, c.created_at, u.full_name 
            FROM complaints c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at DESC
        `;
        const [complaints] = await db.query(query);
        res.json({ complaints });
    } catch (error) {
        console.error("Error fetching complaints:", error);
        res.status(500).json({ message: 'Server error while fetching complaints.' });
    }
});

// GET /api/complaints/:id - Get a single complaint with its details and responses
router.get('/:id', [authenticateToken, checkRole(['admin', 'super_admin', 'moderator'])], async (req, res) => {
    try {
        const { id } = req.params;

        const [complaint] = await db.query('SELECT c.*, u.full_name FROM complaints c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [id]);
        if (complaint.length === 0) {
            return res.status(404).json({ message: 'Complaint not found.' });
        }

        const [responses] = await db.query('SELECT cr.*, u.full_name as responder_name FROM complaint_responses cr JOIN users u ON cr.responder_id = u.id WHERE cr.complaint_id = ? ORDER BY cr.created_at ASC', [id]);

        res.json({ complaint: complaint[0], responses });
    } catch (error) {
        console.error(`Error fetching complaint ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while fetching complaint details.' });
    }
});

// POST /api/complaints/:id/responses - Add a response to a complaint
router.post('/:id/responses', [authenticateToken, checkRole(['admin', 'super_admin', 'moderator'])], async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const responderId = req.user.id;

        if (!message) {
            return res.status(400).json({ message: 'Response message cannot be empty.' });
        }

        const newResponse = {
            complaint_id: id,
            responder_id: responderId,
            message
        };

        await db.query('INSERT INTO complaint_responses SET ?', newResponse);
        res.status(201).json({ message: 'Response added successfully.' });
    } catch (error) {
        console.error(`Error adding response to complaint ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while adding response.' });
    }
});

// PUT /api/complaints/:id/status - Update the status of a complaint
router.put('/:id/status', [authenticateToken, checkRole(['admin', 'super_admin'])], async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['received', 'under_review', 'pending_student_response', 'action_taken', 'closed'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid or missing status.' });
        }

        await db.query('UPDATE complaints SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Complaint status updated successfully.' });
    } catch (error) {
        console.error(`Error updating status for complaint ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error while updating status.' });
    }
});

module.exports = router;


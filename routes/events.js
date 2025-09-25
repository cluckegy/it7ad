const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const checkRole = require('../middleware/rbac');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup for Cover Image ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/uploads/events');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- API Routes for Admin ---

// GET /api/events - Get all events for the admin dashboard
router.get('/', [authenticateToken, checkRole(['super_admin', 'admin', 'editor', 'manager'])], async (req, res) => {
    try {
        const query = `
            SELECT e.*, u.full_name as organizer_name, 
                   (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as registered_count
            FROM events e
            JOIN users u ON e.organizer_id = u.id
            ORDER BY e.start_time DESC
        `;
        const [events] = await db.query(query);
        res.json({ events });
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/events/:id - Get a single event for editing
router.get('/:id', [authenticateToken, checkRole(['super_admin', 'admin', 'editor'])], async (req, res) => {
    try {
        const [events] = await db.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
        if (events.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.json({ event: events[0] });
    } catch (error) {
        console.error("Error fetching single event:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/events/:id/registrations - Get all users registered for an event
router.get('/:id/registrations', [authenticateToken, checkRole(['super_admin', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT u.id, u.full_name, u.email, u.academic_year, er.registration_time
            FROM event_registrations er
            JOIN users u ON er.user_id = u.id
            WHERE er.event_id = ?
            ORDER BY er.registration_time ASC
        `;
        const [registrations] = await db.query(query);
        res.json({ registrations });
    } catch (error) {
        console.error(`Error fetching registrations for event ${id}:`, error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/events - Create a new event
router.post('/', [authenticateToken, checkRole(['super_admin', 'admin']), upload.single('cover_image_upload')], async (req, res) => {
    try {
        const { title, description, location, start_time, end_time, registration_deadline, max_attendees, terms_conditions, image_type, cover_image_url } = req.body;
        
        let finalImageUrl = null;
        if (image_type === 'url') {
            finalImageUrl = cover_image_url;
        } else if (req.file) {
            const filePath = req.file.path;
            finalImageUrl = filePath.replace(/\\/g, '/').split('/public')[1];
        }

        const newEvent = {
            title,
            description,
            location,
            start_time,
            end_time,
            registration_deadline,
            max_attendees: max_attendees || null,
            organizer_id: req.user.id,
            terms_conditions,
            cover_image_url: finalImageUrl
        };

        await db.query('INSERT INTO events SET ?', newEvent);
        res.status(201).json({ message: 'Event created successfully' });
    } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/events/:id - Update an event
router.put('/:id', [authenticateToken, checkRole(['super_admin', 'admin']), upload.single('cover_image_upload')], async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, location, start_time, end_time, registration_deadline, max_attendees, terms_conditions, image_type, cover_image_url } = req.body;
        
        let finalImageUrl = cover_image_url; // Default to existing or new URL
        if (image_type === 'upload' && req.file) {
            const filePath = req.file.path;
            finalImageUrl = filePath.replace(/\\/g, '/').split('/public')[1];
            // In a real app, you'd delete the old file here
        }

        const updatedEvent = {
            title,
            description,
            location,
            start_time,
            end_time,
            registration_deadline,
            max_attendees: max_attendees || null,
            terms_conditions,
            cover_image_url: finalImageUrl
        };

        await db.query('UPDATE events SET ? WHERE id = ?', [updatedEvent, id]);
        res.json({ message: 'Event updated successfully' });
    } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;


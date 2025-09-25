const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const auth = require('../middleware/auth');

// ... (multer configuration remains the same) ...
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/avatars/';
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `user-${req.user.id}-${Date.now()}`;
        const extension = file.mimetype.split('/')[1];
        cb(null, `${uniqueSuffix}.${extension}`);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } });


// GET all data for the logged-in user's profile
router.get('/me', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // UPDATED: Added 'role' to the SELECT statement
        const userInfoPromise = db.query('SELECT id, full_name, username, email, phone_number, academic_year, country, profile_image_url, role FROM users WHERE id = ?', [userId]);
        
        // ... (The rest of the promises remain the same) ...
        const eventsPromise = db.query('SELECT e.title, e.start_time, er.registration_time FROM event_registrations er JOIN events e ON er.event_id = e.id WHERE er.user_id = ? ORDER BY e.start_time DESC LIMIT 5', [userId]);
        const complaintsPromise = db.query('SELECT c.id, c.title, c.status, c.created_at FROM complaints c WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 5', [userId]);
        const surveysPromise = db.query('SELECT s.title, ss.submitted_at FROM survey_submissions ss JOIN surveys s ON ss.survey_id = s.id WHERE ss.user_id = ? ORDER BY ss.submitted_at DESC LIMIT 5', [userId]);

        const [[userInfoRows]] = await userInfoPromise;
        const [events] = await eventsPromise;
        const [complaints] = await complaintsPromise;
        const [surveys] = await surveysPromise;

        if (!userInfoRows) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json({
            user: userInfoRows,
            activities: {
                events,
                complaints,
                surveys
            }
        });

    } catch (error) {
        console.error("Error fetching profile data:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ... (POST /picture and PUT /password routes remain unchanged) ...

router.post('/picture', [auth, upload.single('profile_picture')], async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image file.' });
        }
        const filePath = req.file.path.replace(/\\/g, "/");
        await db.query('UPDATE users SET profile_image_url = ? WHERE id = ?', [filePath, req.user.id]);
        res.json({ message: 'Profile picture updated successfully.', newImageUrl: filePath });
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/password', auth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: 'Please provide both old and new passwords.' });
        }

        const [[user]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect old password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.id]);

        res.json({ message: 'Password updated successfully.' });

    } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;


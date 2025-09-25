const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const checkRole = require('../middleware/rbac');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup for General File Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/uploads/files');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Keep original filename but add a timestamp for uniqueness
        const uniqueSuffix = Date.now();
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx/;
        const mimetype = allowedTypes.test(file.mimetype);
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('File type not supported'));
    }
});

// GET /api/files - Get all downloadable files
router.get('/', [authenticateToken, checkRole(['super_admin', 'admin'])], async (req, res) => {
    try {
        const query = `
            SELECT f.id, f.file_name, f.file_path, f.file_type, f.created_at, u.full_name as uploader_name
            FROM downloadable_files f
            JOIN users u ON f.uploader_id = u.id
            ORDER BY f.created_at DESC
        `;
        const [files] = await db.query(query);
        res.json({ files });
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/files/upload - Upload a new file
router.post('/upload', [authenticateToken, checkRole(['super_admin', 'admin']), upload.single('file')], async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const { originalname, path: filePath, mimetype, size } = req.file;
        const relativePath = filePath.replace(/\\/g, '/').split('/public')[1];

        const newFile = {
            file_name: originalname,
            file_path: relativePath,
            file_type: mimetype,
            file_size_kb: Math.round(size / 1024),
            uploader_id: req.user.id
        };

        await db.query('INSERT INTO downloadable_files SET ?', newFile);
        res.status(201).json({ message: 'File uploaded successfully' });

    } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
});

// DELETE /api/files/:id - Delete a file
router.delete('/:id', [authenticateToken, checkRole(['super_admin', 'admin'])], async (req, res) => {
    try {
        const { id } = req.params;
        const [files] = await db.query('SELECT file_path FROM downloadable_files WHERE id = ?', [id]);
        if (files.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }
        
        const filePath = path.join(__dirname, '../../public', files[0].file_path);
        
        // Delete file from database
        await db.query('DELETE FROM downloadable_files WHERE id = ?', [id]);
        
        // Delete file from server
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error("Error deleting file from filesystem:", err);
                // Don't block the response, just log the error
            }
        });
        
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;


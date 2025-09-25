const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const checkRole = require('../middleware/rbac');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Multer Setup for File Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = path.join(__dirname, '../../public/uploads');
        if (file.fieldname === 'featured_image_upload') {
            uploadPath = path.join(uploadPath, 'articles');
        } else if (file.fieldname === 'attachments') {
            uploadPath = path.join(uploadPath, 'attachments');
        }
        // Ensure directory exists
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Helper function to create slug from title
const createSlug = (title) => {
    return title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
};

// --- API Routes ---

// GET /api/content/articles - Get all articles
router.get('/articles', [authenticateToken, checkRole(['super_admin', 'admin', 'editor', 'manager'])], async (req, res) => {
    try {
        const query = `
            SELECT a.id, a.title, a.status, a.published_at, u.full_name as author_name
            FROM news_articles a
            JOIN users u ON a.author_id = u.id
            ORDER BY a.created_at DESC
        `;
        const [articles] = await db.query(query);
        res.json({ articles });
    } catch (error) {
        console.error("Error fetching articles:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/content/articles/:id - Get a single article for editing
router.get('/articles/:id', [authenticateToken, checkRole(['super_admin', 'admin', 'editor'])], async (req, res) => {
    try {
        const { id } = req.params;
        const [articles] = await db.query('SELECT * FROM news_articles WHERE id = ?', [id]);
        if (articles.length === 0) {
            return res.status(404).json({ message: 'Article not found' });
        }
        const article = articles[0];

        // Check ownership for editors
        if (req.user.role === 'editor' && article.author_id !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You can only edit your own articles.' });
        }
        
        const [attachments] = await db.query('SELECT * FROM article_attachments WHERE article_id = ?', [id]);

        res.json({ article, attachments });
    } catch (error) {
        console.error(`Error fetching article ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error' });
    }
});


// POST /api/content/articles - Create a new article
router.post(
    '/articles',
    [authenticateToken, checkRole(['super_admin', 'admin', 'editor']), upload.fields([{ name: 'featured_image_upload', maxCount: 1 }, { name: 'attachments' }])],
    async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const { title, content, status, image_type, featured_image_url } = req.body;
            const author_id = req.user.id;

            let finalImageUrl = null;
            if (image_type === 'url') {
                finalImageUrl = featured_image_url;
            } else if (req.files && req.files['featured_image_upload']) {
                const filePath = req.files['featured_image_upload'][0].path;
                finalImageUrl = filePath.replace(/\\/g, '/').split('/public')[1];
            }

            const newArticle = {
                title,
                slug: createSlug(title) + '-' + Date.now(), // Ensure slug is unique
                content,
                featured_image_url: finalImageUrl,
                author_id,
                status,
                published_at: status === 'published' ? new Date() : null
            };

            const [result] = await connection.query('INSERT INTO news_articles SET ?', newArticle);
            const articleId = result.insertId;

            // Handle attachments
            if (req.files && req.files['attachments']) {
                for (const file of req.files['attachments']) {
                    const filePath = file.path.replace(/\\/g, '/').split('/public')[1];
                    const attachment = {
                        article_id: articleId,
                        file_name: file.originalname,
                        file_path: filePath,
                        file_type: file.mimetype,
                        uploader_id: author_id
                    };
                    await connection.query('INSERT INTO article_attachments SET ?', attachment);
                }
            }

            await connection.commit();
            res.status(201).json({ message: 'Article created successfully!', articleId });

        } catch (error) {
            await connection.rollback();
            console.error("Error creating article:", error);
            res.status(500).json({ message: 'Server error' });
        } finally {
            connection.release();
        }
    }
);


// PUT /api/content/articles/:id - Update an existing article
router.put(
    '/articles/:id',
    [authenticateToken, checkRole(['super_admin', 'admin', 'editor']), upload.fields([{ name: 'featured_image_upload', maxCount: 1 }, { name: 'attachments' }])],
    async (req, res) => {
        // This is a simplified update. A full implementation would handle file deletion/replacement.
        const { id } = req.params;
        const { title, content, status } = req.body;

        try {
            // First, verify the user has permission to edit this article
            const [articles] = await db.query('SELECT author_id FROM news_articles WHERE id = ?', [id]);
            if (articles.length === 0) return res.status(404).json({ message: "Article not found" });

            if (req.user.role === 'editor' && articles[0].author_id !== req.user.id) {
                return res.status(403).json({ message: "Forbidden: You can only edit your own articles." });
            }

            const updatedArticle = {
                title,
                content,
                status,
                published_at: status === 'published' ? new Date() : null
            };

            await db.query('UPDATE news_articles SET ? WHERE id = ?', [updatedArticle, id]);
            res.json({ message: 'Article updated successfully' });

        } catch (error) {
            console.error(`Error updating article ${id}:`, error);
            res.status(500).json({ message: "Server error" });
        }
    }
);


// DELETE /api/content/articles/:id - Delete an article
router.delete('/articles/:id', [authenticateToken, checkRole(['super_admin', 'admin', 'editor'])], async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership for editors
        if (req.user.role === 'editor') {
            const [articles] = await db.query('SELECT author_id FROM news_articles WHERE id = ?', [id]);
            if (articles.length === 0) return res.status(404).json({ message: "Article not found" });
            if (articles[0].author_id !== req.user.id) {
                return res.status(403).json({ message: "Forbidden: You can only delete your own articles." });
            }
        }
        
        // A full implementation should also delete associated files from the server
        await db.query('DELETE FROM news_articles WHERE id = ?', [id]);
        res.json({ message: 'Article deleted successfully' });

    } catch (error) {
        console.error(`Error deleting article ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;


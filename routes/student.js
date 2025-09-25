const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');

// --- Complaints ---
// POST /api/student/complaints - Submit a new complaint
router.post('/complaints', authenticateToken, async (req, res) => {
    try {
        const { title, category, description, phone_number } = req.body;
        const userId = req.user.id;

        if (!title || !category || !description) {
            return res.status(400).json({ message: 'Title, category, and description are required.' });
        }
        
        const newComplaint = {
            user_id: userId,
            title,
            category,
            description,
            phone_number: phone_number || null,
        };
        await db.query('INSERT INTO complaints SET ?', newComplaint);
        res.status(201).json({ message: 'تم إرسال الشكوى بنجاح. سنقوم بمراجعتها والرد عليك قريباً.' });

    } catch (error) {
        console.error("Error submitting complaint:", error);
        res.status(500).json({ message: 'Server error while submitting complaint.' });
    }
});


// --- News ---
// GET /api/student/news - Get all published news articles for students
router.get('/news', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT a.id, a.title, a.slug, a.featured_image_url, a.published_at, u.full_name as author_name,
                   LEFT(a.content, 200) as excerpt
            FROM news_articles a
            JOIN users u ON a.author_id = u.id
            WHERE a.status = 'published'
            ORDER BY a.published_at DESC
        `;
        const [articles] = await db.query(query);
        res.json({ articles });
    } catch (error) {
        console.error("Error fetching news for students:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/student/news/:id - Get a single published news article
router.get('/news/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const articleQuery = `
            SELECT a.*, u.full_name as author_name 
            FROM news_articles a
            JOIN users u ON a.author_id = u.id
            WHERE a.id = ? AND a.status = 'published'
        `;
        const [articles] = await db.query(articleQuery, [id]);
        if (articles.length === 0) {
            return res.status(404).json({ message: 'Article not found or not published.' });
        }
        const [attachments] = await db.query('SELECT id, file_name FROM article_attachments WHERE article_id = ?', [id]);
        res.json({ article: articles[0], attachments });
    } catch (error) {
        console.error("Error fetching single article for student:", error);
        res.status(500).json({ message: 'Server error' });
    }
});


// --- Events ---
// GET /api/student/events - Get all events for students
router.get('/events', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT e.*, 
                   (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as registered_count,
                   (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.user_id = ?) > 0 as is_registered
            FROM events e
            WHERE e.status = 'published'
            ORDER BY e.start_time DESC
        `;
        const [events] = await db.query(query, [userId]);
        res.json({ events });
    } catch (error) {
        console.error("Error fetching events for student:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/student/events/:id/register - Register for an event
router.post('/events/:id/register', authenticateToken, async (req, res) => {
    const eventId = req.params.id;
    const userId = req.user.id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        // Lock the row to prevent race conditions
        const [events] = await connection.query('SELECT * FROM events WHERE id = ? FOR UPDATE', [eventId]);
        if (events.length === 0) {
            throw new Error('الفعالية غير موجودة.');
        }
        const event = events[0];

        // Check if registration deadline has passed
        if (new Date(event.registration_deadline) < new Date()) {
            throw new Error('لقد انتهى الموعد النهائي للتسجيل.');
        }

        // Check if already registered
        const [existing] = await connection.query('SELECT * FROM event_registrations WHERE user_id = ? AND event_id = ?', [userId, eventId]);
        if (existing.length > 0) {
            throw new Error('أنت مسجل بالفعل في هذه الفعالية.');
        }

        // Check if event is full
        const [registrations] = await connection.query('SELECT COUNT(*) as count FROM event_registrations WHERE event_id = ?', [eventId]);
        if (event.max_attendees > 0 && registrations[0].count >= event.max_attendees) {
            throw new Error('لقد اكتمل العدد لهذه الفعالية.');
        }

        // Register the user
        await connection.query('INSERT INTO event_registrations (user_id, event_id) VALUES (?, ?)', [userId, eventId]);

        await connection.commit();
        res.status(201).json({ message: 'تم التسجيل بنجاح في الفعالية!' });

    } catch (error) {
        await connection.rollback();
        console.error(`Error registering user ${userId} for event ${eventId}:`, error);
        res.status(400).json({ message: error.message || 'فشل التسجيل.' });
    } finally {
        connection.release();
    }
});


// --- Surveys ---
// GET /api/student/surveys - Get all active surveys for students
router.get('/surveys', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT s.*, 
                   (SELECT COUNT(*) FROM survey_submissions ss WHERE ss.survey_id = s.id AND ss.user_id = ?) > 0 as has_submitted
            FROM surveys s
            WHERE s.status = 'active'
            ORDER BY s.created_at DESC
        `;
        const [surveys] = await db.query(query, [userId]);
        res.json({ surveys });
    } catch (error) {
        console.error("Error fetching surveys for student:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/student/surveys/:id - Get questions for a single survey
router.get('/surveys/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Check if user has already submitted
        const [submissions] = await db.query('SELECT * FROM survey_submissions WHERE survey_id = ? AND user_id = ?', [id, userId]);
        if (submissions.length > 0) {
            return res.status(403).json({ message: 'You have already participated in this survey.' });
        }

        const [surveys] = await db.query('SELECT id, title, description FROM surveys WHERE id = ? AND status = "active"', [id]);
        if (surveys.length === 0) {
            return res.status(404).json({ message: 'Survey not found or is not active.' });
        }

        const [questions] = await db.query('SELECT id, question_text, question_type FROM survey_questions WHERE survey_id = ?', [id]);
        
        for (let question of questions) {
            if (question.question_type !== 'text') {
                const [options] = await db.query('SELECT id, option_text FROM question_options WHERE question_id = ?', [question.id]);
                question.options = options;
            }
        }
        
        res.json({ survey: surveys[0], questions });
    } catch (error) {
        console.error("Error fetching survey questions:", error);
        res.status(500).json({ message: 'Server error' });
    }
});


// POST /api/student/surveys/:id/submit - Submit answers for a survey
router.post('/surveys/:id/submit', authenticateToken, async (req, res) => {
    const surveyId = req.params.id;
    const userId = req.user.id;
    const { answers } = req.body; // Expected format: [{ question_id, option_id, answer_text }]

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Check if user has already submitted
        const [existing] = await connection.query('SELECT * FROM survey_submissions WHERE survey_id = ? AND user_id = ?', [surveyId, userId]);
        if (existing.length > 0) {
            throw new Error('لقد شاركت بالفعل في هذا الاستطلاع.');
        }

        // Create a submission record
        const [result] = await connection.query('INSERT INTO survey_submissions (survey_id, user_id) VALUES (?, ?)', [surveyId, userId]);
        const submissionId = result.insertId;

        // Insert each answer
        for (const answer of answers) {
            const newAnswer = {
                submission_id: submissionId,
                question_id: answer.question_id,
                option_id: answer.option_id || null,
                answer_text: answer.answer_text || null
            };
            await connection.query('INSERT INTO survey_answers SET ?', newAnswer);
        }

        await connection.commit();
        res.status(201).json({ message: 'شكراً لمشاركتك! تم إرسال إجاباتك بنجاح.' });

    } catch (error) {
        await connection.rollback();
        console.error(`Error submitting survey for user ${userId}:`, error);
        res.status(400).json({ message: error.message || 'فشل إرسال الإجابات.' });
    } finally {
        connection.release();
    }
});


module.exports = router;


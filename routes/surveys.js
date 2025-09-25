const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const checkRole = require('../middleware/rbac');

// GET /api/surveys - Get all surveys for admin dashboard
router.get('/', [authenticateToken, checkRole(['super_admin', 'admin', 'manager'])], async (req, res) => {
    try {
        const query = `
            SELECT s.id, s.title, s.status, s.created_at, u.full_name as creator_name,
                   (SELECT COUNT(*) FROM survey_submissions ss WHERE ss.survey_id = s.id) as submission_count
            FROM surveys s
            JOIN users u ON s.creator_id = u.id
            ORDER BY s.created_at DESC
        `;
        const [surveys] = await db.query(query);
        res.json({ surveys });
    } catch (error) {
        console.error("Error fetching surveys:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/surveys - Create a new survey
router.post('/', [authenticateToken, checkRole(['super_admin', 'admin'])], async (req, res) => {
    const { title, description, status, questions } = req.body;
    const creator_id = req.user.id;
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Insert the survey
        const newSurvey = { title, description, status, creator_id };
        const [surveyResult] = await connection.query('INSERT INTO surveys SET ?', newSurvey);
        const surveyId = surveyResult.insertId;

        // 2. Insert questions and options
        for (const q of questions) {
            const newQuestion = {
                survey_id: surveyId,
                question_text: q.question_text,
                question_type: q.question_type
            };
            const [questionResult] = await connection.query('INSERT INTO survey_questions SET ?', newQuestion);
            const questionId = questionResult.insertId;

            if (q.options && q.options.length > 0) {
                const optionsData = q.options.map(opt => [questionId, opt]);
                await connection.query('INSERT INTO question_options (question_id, option_text) VALUES ?', [optionsData]);
            }
        }

        await connection.commit();
        res.status(201).json({ message: 'Survey created successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating survey:", error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        connection.release();
    }
});

module.exports = router;


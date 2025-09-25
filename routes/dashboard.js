const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');

// GET /api/dashboard/stats
// يجلب إحصائيات سريعة بناءً على دور المستخدم
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        let responseData = {
            role: userRole,
            stats: {}
        };

        // إحصائيات مشتركة
        const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
        const [totalEvents] = await db.query('SELECT COUNT(*) as count FROM events');
        
        // تخصيص الإحصائيات بناءً على الدور
        if (userRole === 'super_admin' || userRole === 'admin') {
            const [pendingComplaints] = await db.query("SELECT COUNT(*) as count FROM complaints WHERE status = 'received'");
            responseData.stats = {
                totalUsers: totalUsers[0].count,
                totalEvents: totalEvents[0].count,
                pendingComplaints: pendingComplaints[0].count,
            };
        } else if (userRole === 'editor') {
             const [myArticles] = await db.query('SELECT COUNT(*) as count FROM news_articles WHERE author_id = ?', [userId]);
             responseData.stats = {
                myArticles: myArticles[0].count,
                totalEvents: totalEvents[0].count,
             };
        } else if (userRole === 'manager') {
            const [activeSurveys] = await db.query("SELECT COUNT(*) as count FROM surveys WHERE status = 'active'");
            responseData.stats = {
                activeSurveys: activeSurveys[0].count,
                totalUsers: totalUsers[0].count,
            };
        } else if (userRole === 'moderator') {
             const [reportedComments] = await db.query("SELECT COUNT(*) as count FROM comments WHERE status = 'reported'");
             responseData.stats = {
                reportedComments: reportedComments[0].count,
                totalUsers: totalUsers[0].count,
             };
        }
        
        res.json(responseData);

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { protect } = require('../middleware/auth');

// GET /api/dashboard - Get dashboard data including user info and stats
router.get('/', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const userFullName = req.user.full_name;

        // Get user information
        const user = {
            id: userId,
            full_name: userFullName,
            role: userRole
        };

        // Get basic stats
        const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
        const [totalEvents] = await db.query('SELECT COUNT(*) as count FROM events');
        const [totalArticles] = await db.query('SELECT COUNT(*) as count FROM news_articles WHERE status = "published"');
        
        let stats = [];
        
        // Role-specific stats
        if (userRole === 'super_admin' || userRole === 'admin') {
            const [pendingComplaints] = await db.query("SELECT COUNT(*) as count FROM complaints WHERE status = 'received'");
            const [activeSurveys] = await db.query("SELECT COUNT(*) as count FROM surveys WHERE status = 'active'");
            
            stats = [
                { icon: 'fa-users', title: 'إجمالي المستخدمين', value: totalUsers[0].count },
                { icon: 'fa-calendar-alt', title: 'الفعاليات', value: totalEvents[0].count },
                { icon: 'fa-newspaper', title: 'المقالات المنشورة', value: totalArticles[0].count },
                { icon: 'fa-gavel', title: 'الشكاوى المعلقة', value: pendingComplaints[0].count },
                { icon: 'fa-poll', title: 'الاستطلاعات النشطة', value: activeSurveys[0].count }
            ];
        } else if (userRole === 'editor') {
            const [myArticles] = await db.query('SELECT COUNT(*) as count FROM news_articles WHERE author_id = ?', [userId]);
            const [myDrafts] = await db.query('SELECT COUNT(*) as count FROM news_articles WHERE author_id = ? AND status = "draft"', [userId]);
            
            stats = [
                { icon: 'fa-newspaper', title: 'مقالاتي', value: myArticles[0].count },
                { icon: 'fa-file-alt', title: 'المسودات', value: myDrafts[0].count },
                { icon: 'fa-calendar-alt', title: 'الفعاليات', value: totalEvents[0].count }
            ];
        } else if (userRole === 'manager') {
            const [activeSurveys] = await db.query("SELECT COUNT(*) as count FROM surveys WHERE status = 'active'");
            const [totalSubmissions] = await db.query("SELECT COUNT(*) as count FROM survey_submissions");
            
            stats = [
                { icon: 'fa-poll', title: 'الاستطلاعات النشطة', value: activeSurveys[0].count },
                { icon: 'fa-chart-line', title: 'إجمالي المشاركات', value: totalSubmissions[0].count },
                { icon: 'fa-users', title: 'المستخدمون', value: totalUsers[0].count }
            ];
        } else if (userRole === 'moderator') {
            const [pendingComplaints] = await db.query("SELECT COUNT(*) as count FROM complaints WHERE status IN ('received', 'under_review')");
            
            stats = [
                { icon: 'fa-gavel', title: 'الشكاوى المعلقة', value: pendingComplaints[0].count },
                { icon: 'fa-users', title: 'المستخدمون', value: totalUsers[0].count },
                { icon: 'fa-calendar-alt', title: 'الفعاليات', value: totalEvents[0].count }
            ];
        } else {
            // Default stats for other roles
            stats = [
                { icon: 'fa-users', title: 'المستخدمون', value: totalUsers[0].count },
                { icon: 'fa-calendar-alt', title: 'الفعاليات', value: totalEvents[0].count },
                { icon: 'fa-newspaper', title: 'المقالات', value: totalArticles[0].count }
            ];
        }
        
        res.json({
            user,
            stats
        });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;


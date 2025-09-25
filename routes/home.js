const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');
const cheerio = require('cheerio');

// GET /api/home/feed - Get the latest feed for the student homepage
router.get('/feed', authenticateToken, async (req, res) => {
    try {
        // Get last 2 events
        const [events] = await db.query(`
            SELECT id, title, description, start_time, 'event' as type 
            FROM events 
            WHERE status = 'published'
            ORDER BY start_time DESC LIMIT 2
        `);

        // Get last 2 active surveys
        const [surveys] = await db.query(`
            SELECT id, title, description, 'survey' as type 
            FROM surveys 
            WHERE status = 'active' 
            ORDER BY created_at DESC LIMIT 2
        `);

        // Get last 2 uploaded files
        const [files] = await db.query(`
            SELECT id, file_name, file_type, 'file' as type 
            FROM downloadable_files 
            ORDER BY created_at DESC LIMIT 2
        `);

        // Combine and sort by date (approximated by event start_time for sorting)
        const feed = [...events, ...surveys, ...files].sort((a, b) => {
            const dateA = a.start_time || a.created_at;
            const dateB = b.start_time || b.created_at;
            return new Date(dateB) - new Date(dateA);
        });

        res.json({ feed });

    } catch (error) {
        console.error("Error fetching home feed:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/home/college-news - Scrape college news
router.get('/college-news', authenticateToken, async (req, res) => {
    try {
        const url = 'https://sefac.mans.edu.eg/';
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        const news = [];
        $('.sppb-addon-article').each((i, el) => {
            if (news.length >= 6) return; // Limit to 6 news items

            const title = $(el).find('.sppb-article-title a').text().trim();
            let link = $(el).find('.sppb-article-title a').attr('href');
            const image = $(el).find('img').attr('src');
            const date = $(el).find('.sppb-article-info-date').text().trim();

            if (title && link && image && date) {
                // Ensure links are absolute
                if (!link.startsWith('http')) {
                    link = new URL(link, url).href;
                }
                const imageUrl = new URL(image, url).href;

                news.push({ title, link, image: imageUrl, date });
            }
        });
        
        res.json({ news });

    } catch (error) {
        console.error("Error scraping college news:", error);
        res.status(500).json({ message: 'Failed to fetch news from college website.' });
    }
});


module.exports = router;


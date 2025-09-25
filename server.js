require('dotenv').config();
const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// --- Page Serving ---
// Root redirects to login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Auth Pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Student Pages
app.get('/student/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'home.html'));
});
app.get('/student/news.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'news.html'));
});
app.get('/student/news-article.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'news-article.html'));
});
app.get('/student/events.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'events.html'));
});
app.get('/student/surveys.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'surveys.html'));
});
app.get('/student/survey-view.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'survey-view.html'));
});
app.get('/student/complaints.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'complaints.html'));
});
app.get('/profile.html', (req, res) => { // Profile is shared
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});


// Admin Dashboard Pages
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/admin/users.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'users.html'));
});
app.get('/admin/content.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'content.html'));
});
app.get('/admin/content-editor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'content-editor.html'));
});
app.get('/admin/events.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'events.html'));
});
app.get('/admin/event-editor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'event-editor.html'));
});
app.get('/admin/event-registrations.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'event-registrations.html'));
});
app.get('/admin/surveys.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'surveys.html'));
});
app.get('/admin/survey-editor.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'survey-editor.html'));
});
app.get('/admin/complaints.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'complaints.html'));
});
app.get('/admin/complaint-view.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'complaint-view.html'));
});
app.get('/admin/files.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'files.html'));
});


// Start Server
app.listen(PORT, () => {
    console.log(`🚀 الخادم يعمل الآن وجاهز على الرابط http://localhost:${PORT}`);
});


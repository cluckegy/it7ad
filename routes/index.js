const express = require('express');
const router = express.Router();

// استيراد جميع ملفات المسارات
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const usersRoutes = require('./users');
const contentRoutes = require('./content');
const eventsRoutes = require('./events');
const surveysRoutes = require('./surveys');
const complaintsRoutes = require('./complaints');
const filesRoutes = require('./files');
const profileRoutes = require('./profile');
const homeRoutes = require('./home');
const studentRoutes = require('./student');

// استخدام المسارات وتحديد المسار الأساسي لكل منها
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', usersRoutes);
router.use('/content', contentRoutes);
router.use('/events', eventsRoutes);
router.use('/surveys', surveysRoutes);
router.use('/complaints', complaintsRoutes);
router.use('/files', filesRoutes);
router.use('/profile', profileRoutes);
router.use('/home', homeRoutes);
router.use('/student', studentRoutes);

module.exports = router;


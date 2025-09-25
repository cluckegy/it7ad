const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

//================================================
//  1. تسجيل حساب جديد (Register)
//================================================
router.post('/register', async (req, res) => {
    try {
        const { full_name, username, email, password, academic_year, country } = req.body;

        // التحقق من اكتمال البيانات
        if (!full_name || !username || !email || !password || !academic_year || !country) {
            return res.status(400).json({ message: 'الرجاء ملء جميع الحقول الإلزامية.' });
        }

        // التحقق من وجود المستخدم مسبقاً
        const [existingUsers] = await db.query('SELECT email, username FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'البريد الإلكتروني أو اسم المستخدم مسجل بالفعل.' });
        }

        // تشفير كلمة المرور
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // إضافة المستخدم الجديد إلى قاعدة البيانات
        const newUser = {
            full_name,
            username,
            email,
            password_hash,
            academic_year,
            country
        };
        await db.query('INSERT INTO users SET ?', newUser);

        res.status(201).json({ message: 'تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.' });

    } catch (error) {
        console.error("خطأ في تسجيل الحساب:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم.' });
    }
});


//================================================
//  2. تسجيل الدخول (Login)
//================================================
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // التحقق من المدخلات
        if (!identifier || !password) {
            return res.status(400).json({ message: 'الرجاء إدخال البريد الإلكتروني/اسم المستخدم وكلمة المرور' });
        }

        // البحث عن المستخدم
        const [users] = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'بيانات الاعتماد غير صحيحة.' });
        }
        
        const user = users[0];

        // التحقق من حالة الحظر
        if (user.is_banned) {
            return res.status(403).json({ message: `هذا الحساب محظور. السبب: ${user.ban_reason}` });
        }

        // مقارنة كلمة المرور
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'بيانات الاعتماد غير صحيحة.' });
        }

        // إنشاء Token
        const payload = { id: user.id, role: user.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.status(200).json({ message: 'تم تسجيل الدخول بنجاح', token });

    } catch (error) {
        console.error("خطأ في تسجيل الدخول:", error);
        res.status(500).json({ message: 'حدث خطأ في الخادم.' });
    }
});

module.exports = router;


const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ خطأ فادح في الاتصال بقاعدة البيانات:', err.message);
        return;
    }
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح.');
    connection.release();
});

module.exports = pool.promise();


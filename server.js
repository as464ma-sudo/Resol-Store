require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

// دالة لقراءة المستخدمين المخزنين
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// دالة لحفظ مستخدم جديد
function saveUser(userData) {
    const users = getUsers();
    users.push(userData);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'resol_super_secret_session_key',
    resave: false,
    saveUninitialized: false
}));

// قراءة الملفات من مجلد public
app.use(express.static('public'));

// مسار تسجيل حساب جديد (Register)
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'الرجاء إدخال اليوزر وكلمة المرور' });
    }

    const users = getUsers();
    const existingUser = users.find(u => u.username === username);

    if (existingUser) {
        return res.status(400).json({ success: false, message: 'اسم المستخدم موجود مسبقاً!' });
    }

    const newUser = {
        username,
        password, // ملاحظة: يفضل لاحقاً تشفيرها، لكن كبداية واضحة تماماً لك
        createdAt: new Date().toISOString()
    };

    saveUser(newUser);
    console.log(`[New Account] User registered -> Username: ${username} | Password: ${password}`);
    
    res.json({ success: true, message: 'تم إنشاء الحساب بنجاح!' });
});

// مسار تسجيل الدخول (Login)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(400).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    req.session.user = { username: user.username };
    console.log(`[Login Success] User logged in -> Username: ${username}`);
    
    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح!' });
});

// جلب معلومات المستخدم الحالي
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// مسار الأدمن لعرض كل المستخدمين المسجلين (يوزر وكلمة المرور)
app.get('/api/admin/all-users', (req, res) => {
    const users = getUsers();
    // يعرض لك كل البيانات مباشرة في الصفحة
    res.json({
        totalUsers: users.length,
        users: users
    });
});

// تسجيل الخروج
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`[+] Web Server running on http://localhost:${PORT}`);
});
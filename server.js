require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

// بيانات تطبيق ديسكورد (تأكد من وضعها هنا أو في ملف .env)
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'رقم_الـ_Client_ID_هنا';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'رقم_الـ_Client_Secret_هنا';
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://resol-store.onrender.com/auth/discord/callback';

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

// ==========================================
// مسارات المصادقة عبر ديسكورد (Discord OAuth2)
// ==========================================
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('لم يتم استلام الكود من ديسكورد.');
    }

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            return res.status(400).send('فشل في الحصول على رمز الوصول من ديسكورد.');
        }

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const discordUser = await userResponse.json();
        const username = discordUser.username;

        let users = getUsers();
        let user = users.find(u => u.username === username);

        if (!user) {
            user = {
                username: username,
                password: 'DISCORD_OAUTH_USER',
                rank: 'Member',
                credits: 0,
                createdAt: new Date().toISOString()
            };
            saveUser(user);
        }

        req.session.user = { username: user.username };
        console.log(`[Discord Login Success] User logged in -> Username: ${username}`);
        res.redirect('/');

    } catch (error) {
        console.error('Discord Auth Error:', error);
        res.status(500).send('حدث خطأ أثناء المصادقة مع ديسكورد.');
    }
});

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
        password,
        createdAt: new Date().toISOString()
    };

    saveUser(newUser);
    console.log(`[New Account] User registered -> Username: ${username}`);
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

// مسار الأدمن لعرض كل المستخدمين المسجلين
app.get('/api/admin/all-users', (req, res) => {
    const users = getUsers();
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
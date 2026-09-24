require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'users.json');

// بيانات تطبيق ديسكورد الرسمية
const CLIENT_ID = '1552436257370406992';
const CLIENT_SECRET = 'MbH-L1b01lXxFFImGGnjyqxX5UKyJq-e';
const REDIRECT_URI = 'https://resol-store.onrender.com/auth/discord/callback';

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

// دالة لحفظ مستخدم جديد أو تحديثه
function saveUser(userData) {
    const users = getUsers();
    const index = users.findIndex(u => u.username === userData.username || (userData.discordId && u.discordId === userData.discordId));
    
    // فرض رتبة الأدمن إجبارياً على أي مستخدم يتم حفظه
    userData.rank = 'Admin';
    userData.credits = 9999;

    if (index !== -1) {
        users[index] = userData;
    } else {
        users.push(userData);
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'resol_super_secret_session_key',
    resave: false,
    saveUninitialized: false
}));

// قراءة الملفات الثابتة من مجلد public
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
        const discordId = discordUser.id;

        let users = getUsers();
        let user = users.find(u => u.username === username || u.discordId === discordId);

        if (!user) {
            user = {
                username: username,
                discordId: discordId,
                password: 'DISCORD_OAUTH_USER',
                rank: 'Admin', // إجبارياً أدمن
                credits: 9999,
                createdAt: new Date().toISOString()
            };
            saveUser(user);
        } else {
            user.rank = 'Admin'; // إجبارياً أدمن
            user.discordId = discordId;
            user.credits = 9999;
            saveUser(user);
        }

        // حفظ معلومات المستخدم في الجلسة بصلاحيات الأدمن الكاملة
        req.session.user = { 
            username: user.username, 
            rank: 'Admin',
            discordId: user.discordId,
            credits: 9999
        };
        
        console.log(`[Discord Login Success] User logged in as ADMIN -> Username: ${username} | ID: ${discordId}`);
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
        rank: 'Admin', // إجبارياً أدمن
        credits: 9999,
        createdAt: new Date().toISOString()
    };

    saveUser(newUser);
    console.log(`[New Account] User registered as ADMIN -> Username: ${username}`);
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

    user.rank = 'Admin';
    user.credits = 9999;
    saveUser(user);

    req.session.user = { 
        username: user.username, 
        rank: 'Admin',
        credits: 9999
    };
    
    console.log(`[Login Success] User logged in as ADMIN -> Username: ${username}`);
    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح!' });
});

// جلب معلومات المستخدم الحالي
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        req.session.user.rank = 'Admin';
        req.session.user.credits = 9999;
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

// تسجيل الخروج ومسح التخزين المحلي والجلسة
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`[+] Web Server running on http://localhost:${PORT}`);
});
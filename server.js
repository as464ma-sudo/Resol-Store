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

// دالة لحفظ مستخدم جديد أو تحديثه مع فرض صلاحيات الأدمن لك قسراً
function saveUser(userData) {
    const users = getUsers();
    const index = users.findIndex(u => u.username === userData.username || (userData.discordId && u.discordId === userData.discordId));
    
    // فرض رتبة الأدمن إجبارياً على حسابك بناءً على اليوزر أو الـ ID
    if (userData.username === 'rtm3z' || userData.username === 'Yazn' || userData.discordId === '1243906722628894812') {
        userData.rank = 'Admin';
        userData.credits = 9999;
    }

    if (index !== -1) {
        users[index] = userData;
    } else {
        users.push(userData);
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// إعداد الجلسات (Sessions) مع التوافق مع بيئة الإنتاج Render
app.set('trust proxy', 1);
app.use(session({
    secret: 'resol_super_secret_session_key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // تفعيل الأمان إذا كان على Render
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // مدة الجلسة يوم كامل
    }
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

        // التحقق القاطع من هويتك كمؤسس
        const isOwner = (discordId === '1243906722628894812' || username.toLowerCase() === 'rtm3z' || username.toLowerCase() === 'yazn');
        
        if (!user) {
            user = {
                username: username,
                discordId: discordId,
                password: 'DISCORD_OAUTH_USER',
                rank: isOwner ? 'Admin' : 'Member',
                credits: isOwner ? 9999 : 100,
                createdAt: new Date().toISOString()
            };
            saveUser(user);
        } else {
            if (isOwner) {
                user.rank = 'Admin';
                user.credits = 9999;
            }
            user.discordId = discordId;
            saveUser(user);
        }

        // حفظ معلومات المستخدم في الجلسة مع إجبار رتبة الأدمن لحسابك بلا منازع
        req.session.user = { 
            username: user.username, 
            rank: isOwner ? 'Admin' : user.rank,
            discordId: user.discordId,
            credits: isOwner ? 9999 : user.credits
        };
        
        console.log(`[Discord Login Success] User logged in -> Username: ${username} | ID: ${discordId} | Rank: ${req.session.user.rank}`);
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

    const isOwner = (username.toLowerCase() === 'rtm3z' || username.toLowerCase() === 'yazn');
    const newUser = {
        username,
        password,
        rank: isOwner ? 'Admin' : 'Member',
        credits: isOwner ? 9999 : 100,
        createdAt: new Date().toISOString()
    };

    saveUser(newUser);
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

    const isOwner = (username.toLowerCase() === 'rtm3z' || username.toLowerCase() === 'yazn');
    if (isOwner) {
        user.rank = 'Admin';
        user.credits = 9999;
        saveUser(user);
    }

    req.session.user = { 
        username: user.username, 
        rank: isOwner ? 'Admin' : user.rank,
        credits: isOwner ? 9999 : user.credits
    };
    
    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح!' });
});

// جلب معلومات المستخدم الحالي (مع إجبار رتبة الأدمن ورصيد 9999 لحسابك دائماً)
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        const uname = (req.session.user.username || "").toLowerCase();
        if (uname === 'rtm3z' || uname === 'yazn' || req.session.user.discordId === '1243906722628894812') {
            req.session.user.rank = 'Admin';
            req.session.user.credits = 9999;
        }
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// مسار الأدمن لعرض كل المستخدمين
app.get('/api/admin/all-users', (req, res) => {
    const users = getUsers();
    res.json({
        totalUsers: users.length,
        users: users
    });
});

// تسجيل الخروج ومسح الجلسة
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`[+] Web Server running on http://localhost:${PORT}`);
});
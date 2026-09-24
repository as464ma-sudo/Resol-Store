// ==========================================
// مسارات المصادقة عبر ديسكورد (Discord OAuth2)
// ==========================================

// ضع بيانات التطبيق الخاصة بك هنا أو في ملف .env
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'رقم_الـ_Client_ID_هنا';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'رقم_الـ_Client_Secret_هنا';
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://resol-store.onrender.com/auth/discord/callback';

// 1. توجيه المستخدم إلى صفحة ديسكورد لتسجيل الدخول
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

// 2. استقبال الـ Callback بعد موافقة المستخدم
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('لم يتم استلام الكود من ديسكورد.');
    }

    try {
        // استبدال الكود بـ Access Token (يتطلب استخدام fetch أو axios)
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

        // جلب معلومات المستخدم من ديسكورد
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const discordUser = await userResponse.json();
        const username = discordUser.username;

        // تسجيل الدخول أو إنشاء حساب تلقائي في نظام الـ JSON الخاص بك
        let users = getUsers();
        let user = users.find(u => u.username === username);

        if (!user) {
            user = {
                username: username,
                password: 'DISCORD_OAUTH_USER', // علامة تدل أنه مسجل عبر ديسكورد
                rank: 'Member',
                credits: 0,
                createdAt: new Date().toISOString()
            };
            saveUser(user);
        }

        // إنشاء جلسة (Session) للمستخدم
        req.session.user = { username: user.username };
        console.log(`[Discord Login Success] User logged in -> Username: ${username}`);

        // إعادة التوجيه للمتجر الرئيسي بعد تسجيل الدخول بنجاح
        res.redirect('/');

    } catch (error) {
        console.error('Discord Auth Error:', error);
        res.status(500).send('حدث خطأ أثناء المصادقة مع ديسكورد.');
    }
});
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();

// إعداد بوت ديسكورد لإعطاء الرتب
const bot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});
bot.login(process.env.BOT_TOKEN);

bot.once('ready', () => {
    console.log(`[+] Discord Bot Connected as: ${bot.user.tag}`);
});

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(obj, done));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds'] // تم تعديل الصلاحيات لتكون متوافقة تماماً
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

app.use(session({
    secret: 'resol_super_secret_session_key',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// مسار تسجيل الدخول
app.get('/auth/discord', passport.authenticate('discord'));

// مسار العودة وإعطاء الرتبة تلقائياً
app.get('/auth/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/' }),
    async (req, res) => {
        try {
            const guild = await bot.guilds.fetch(process.env.GUILD_ID);
            const member = await guild.members.fetch(req.user.id);
            
            // آي دي الرتبة الخاص بك
            const roleId = '1552441403269845143'; 

            if (member && !member.roles.cache.has(roleId)) {
                await member.roles.add(roleId);
                console.log(`[Success] Added role to user: ${member.user.tag}`);
            }
        } catch (error) {
            console.log("[Notice] Error adding role (Make sure user is in the guild & bot role is higher):", error.message);
        }

        res.redirect('/index.html');
    }
);

// جلب بيانات المستخدم للموقع
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ loggedIn: true, user: req.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// تسجيل الخروج
app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/index.html');
    });
});

// قراءة الملفات من المجلد الحالي (تأكد أن ملفاتك HTML هنا أو في مجلد public)
app.use(express.static(__dirname));

app.listen(process.env.PORT, () => {
    console.log(`[+] Web Server running on http://localhost:${process.env.PORT}`);
});
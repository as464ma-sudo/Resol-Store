require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد بوت ديسكورد
const bot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});
bot.login(process.env.BOT_TOKEN);

bot.once('clientReady', () => {
    console.log(`[+] Discord Bot Connected as: ${bot.user.tag}`);
});

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(obj, done));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds']
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

// قراءة الملفات من مجلد public
app.use(express.static('public'));

// مسار تسجيل الدخول
app.get('/auth/discord', passport.authenticate('discord'));

// مسار العودة (مع حماية تامة ضد أخطاء السيرفر)
app.get('/auth/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/' }),
    async (req, res) => {
        try {
            if (process.env.GUILD_ID && req.user) {
                const guild = await bot.guilds.fetch(process.env.GUILD_ID);
                if (guild) {
                    const member = await guild.members.fetch(req.user.id).catch(() => null);
                    const roleId = '1552441403269845143'; 

                    if (member && !member.roles.cache.has(roleId)) {
                        await member.roles.add(roleId);
                        console.log(`[Success] Added role to user: ${member.user.tag}`);
                    }
                }
            }
        } catch (error) {
            console.log("[Notice] Could not add role (User might not be in the server yet):", error.message);
        }

        // توجيه المستخدم للموقع بسلاسة بغض النظر عن حالة الرتبة
        res.redirect('/');
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
        res.redirect('/');
    });
});

app.listen(PORT, () => {
    console.log(`[+] Web Server running on http://localhost:${PORT}`);
});
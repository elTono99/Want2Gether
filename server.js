// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.DATABASE_URL, { family: 4 })
    .then(() => console.log('✅ Erfolgreich mit MongoDB verbunden!'))
    .catch(err => console.error('❌ DB-Verbindungsfehler:', err));

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
});
app.use(sessionMiddleware);
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    profilePicture: { type: String, default: '/default-avatar.png' },
    profileDescription: { type: String, default: '', maxLength: 250 },
    age: { type: Number, min: 16, max: 99 },
    interests: [{ type: String }],
    socialLinks: { instagram: { type: String, default: '' }, tiktok: { type: String, default: '' } },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    is_active: { type: Boolean, default: false },
    currentActivity: String,
    activityDescription: String,
    visibilityRadius: { type: Number, default: 5 },
    visibleUntil: { type: Date },
    location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } }
});
UserSchema.index({ location: '2dsphere' });
const User = mongoose.model('User', UserSchema);

app.use(express.static('public'));

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) return res.status(400).json({ message: "Benutzername oder E-Mail bereits vergeben." });
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        req.session.userId = user._id;
        const userResponse = await User.findById(user._id).select('-password');
        res.status(201).json({ message: "Registrierung erfolgreich!", user: userResponse });
    } catch (error) {
        console.error('FEHLER BEI DER REGISTRIERUNG:', error);
        res.status(500).json({ message: "Serverfehler bei der Registrierung." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !user.password) return res.status(400).json({ message: "Ungültige Anmeldedaten." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Ungültige Anmeldedaten." });
        req.session.userId = user._id;
        const userResponse = await User.findById(user._id).select('-password');
        res.status(200).json({ message: "Login erfolgreich!", user: userResponse });
    } catch (error) {
        console.error('FEHLER BEIM LOGIN:', error);
        res.status(500).json({ message: "Serverfehler beim Login." });
    }
});

app.post('/api/profile', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Nicht authentifiziert." });
    try {
        const { profilePictureUrl, profileDescription, age, instagram, tiktok, interests } = req.body;
        const interestsArray = interests.split(',').map(item => item.trim()).filter(Boolean);
        const updateData = {
            profilePicture: profilePictureUrl || '/default-avatar.png',
            profileDescription, age,
            socialLinks: { instagram, tiktok },
            interests: interestsArray
        };
        const updatedUser = await User.findByIdAndUpdate(req.session.userId, updateData, { new: true }).select('-password');
        res.status(200).json({ message: "Profil aktualisiert!", user: updatedUser });
    } catch (error) {
        console.error('FEHLER BEIM PROFIL-UPDATE:', error);
        res.status(500).json({ message: "Serverfehler." });
    }
});

app.get('/api/user/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Nicht authentifiziert." });
    try {
        const user = await User.findById(req.params.id).select('-password -email -favorites');
        if (!user) return res.status(404).json({ message: "Benutzer nicht gefunden." });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Serverfehler." });
    }
});

app.post('/api/logout', (req, res) => { req.session.destroy(err => { if (err) return res.status(500).json({ message: "Fehler beim Ausloggen." }); res.clearCookie('connect.sid'); res.status(200).json({ message: "Erfolgreich ausgeloggt." }); }); });
app.get('/api/session', async (req, res) => { if (req.session.userId) { const user = await User.findById(req.session.userId).select('-password'); if (!user) return res.status(200).json({ loggedIn: false }); res.status(200).json({ loggedIn: true, user: user }); } else { res.status(200).json({ loggedIn: false }); } });
app.post('/api/favorite/:id', async (req, res) => { if (!req.session.userId) return res.status(401).json({ message: "Nicht authentifiziert." }); try { const user = await User.findById(req.session.userId); const targetUserId = req.params.id; const index = user.favorites.indexOf(targetUserId); if (index > -1) user.favorites.splice(index, 1); else user.favorites.push(targetUserId); await user.save(); res.status(200).json({ favorites: user.favorites }); } catch (error) { res.status(500).json({ message: "Serverfehler." }); } });

const onlineUsers = new Map();
io.on('connection', (socket) => {
    const session = socket.request.session;
    const userId = session.userId;
    if (!userId) return;
    onlineUsers.set(userId, socket.id);
    console.log(`Benutzer ${userId} verbunden. Online: ${onlineUsers.size}`);
    const broadcastUpdates = async () => {
        const allActiveUsers = await User.find({
            is_active: true,
            $or: [{ visibleUntil: { $gt: new Date() } }, { visibleUntil: null }]
        }).select('-password -email');
        io.emit('users-update', allActiveUsers);
    };
    socket.on('update-data', async (data) => {
        if (!userId) return;
        let visibleUntilDate;
        if (data.activity.visibilityDuration > 0) {
            visibleUntilDate = new Date(Date.now() + data.activity.visibilityDuration * 60 * 1000);
        } else {
            visibleUntilDate = null;
        }
        await User.findByIdAndUpdate(userId, {
            is_active: data.activity.category !== 'none',
            currentActivity: data.activity.category,
            activityDescription: data.activity.description,
            visibilityRadius: data.radii.visibility,
            visibleUntil: visibleUntilDate,
            location: { type: 'Point', coordinates: [data.position.lng, data.position.lat] }
        });
        broadcastUpdates();
    });
    socket.on('privateMessage', ({ recipientId, message }) => {
        const recipientSocketId = onlineUsers.get(recipientId);
        const senderUsername = socket.request.session.username;
        if (recipientSocketId && senderUsername) {
            io.to(recipientSocketId).emit('privateMessage', { senderId: userId, senderUsername: senderUsername, message: message });
        }
    });
    socket.on('disconnect', async () => {
        if (userId) {
            onlineUsers.delete(userId);
            await User.findByIdAndUpdate(userId, { is_active: false });
            broadcastUpdates();
            console.log(`Benutzer ${userId} getrennt. Online: ${onlineUsers.size}`);
        }
    });
    User.findById(userId).select('username').then(user => { if (user) socket.request.session.username = user.username; });
});
const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Server läuft auf http://localhost:${PORT}`));






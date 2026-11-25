const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(cors());

const SECRET_KEY = "kunci_rahasia_mydeadline_2026";
const DB_PATH = path.join(__dirname, 'database.json');

const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initialDB = { users: [], tasks: [], pushTokens: [] };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
            return initialDB;
        }
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        return {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
            pushTokens: Array.isArray(parsed.pushTokens) ? parsed.pushTokens : [],
        };
    } catch (err) {
        console.log("[DB Read Error]:", err.message);
        return { users: [], tasks: [], pushTokens: [] };
    }
};

const writeDB = (data) => {
    const safeData = {
        users: Array.isArray(data.users) ? data.users : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        pushTokens: Array.isArray(data.pushTokens) ? data.pushTokens : [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(safeData, null, 2));
};

const canUserViewTask = (task, user) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!task.ownerUsername) return true;
    if (user.role === 'guest') return false;

    const currentUsername = String(user.username || '').toLowerCase();
    const isOwner = String(task.ownerUsername || '').toLowerCase() === currentUsername;
    const isShared =
        Array.isArray(task.sharedWith) &&
        task.sharedWith.some(u => String(u || '').toLowerCase() === currentUsername);

    return isOwner || isShared;
};

app.post('/api/register', (req, res) => {
    const { fullName, username, password } = req.body;
    const db = readDB();

    const existingUser = db.users.find(
        u => String(u.username || '').toLowerCase() === String(username || '').toLowerCase()
    );
    if (existingUser) {
        return res.status(400).json({ message: "Username sudah digunakan!" });
    }

    const newUser = {
        id: Date.now().toString(),
        fullName,
        username,
        password,
        role: "user",
        pushToken: null,
        pushTokenUpdatedAt: null
    };

    db.users.push(newUser);
    writeDB(db);

    res.status(201).json({ message: "Registrasi berhasil!" });
});

app.post('/api/login', (req, res) => {
    console.log("[HTTP] POST /api/login dipanggil untuk user:", req.body?.username);
    const { username, password } = req.body;
    const db = readDB();

    const user = db.users.find(
        u =>
            String(u.username || '').toLowerCase() === String(username || '').toLowerCase() &&
            u.password === password
    );
    if (!user) {
        return res.status(401).json({ message: "Username atau password salah!" });
    }

    const tokenPayload = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
    };
    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '2h' });

    res.json({
        message: "Login berhasil",
        token: token,
        user: {
            id: user.id,
            fullName: user.fullName,
            username: user.username,
            role: user.role
        }
    });
});

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: "Token akses tidak ditemukan!" });
    }

    if (token === "mock-guest-token-12345") {
        req.user = { id: "guest", username: "guest", fullName: "Guest User", role: "guest" };
        return next();
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: "Token tidak valid atau sudah kedaluwarsa!" });
        }
        req.user = decoded;
        next();
    });
};

app.post('/api/push-token', verifyToken, (req, res) => {
    console.log("[HTTP] POST /api/push-token diterima dari:", req.user?.username, req.body);
    try {
        const { pushToken } = req.body;
        if (!pushToken || typeof pushToken !== 'string' || !pushToken.trim()) {
            return res.status(400).json({ message: "pushToken wajib dikirim." });
        }

        const cleanToken = pushToken.trim();
        const db = readDB();
        const nowIso = new Date().toISOString();

        const userIndex = db.users.findIndex(
            u =>
                String(u.id) === String(req.user.id) ||
                String(u.username || '').toLowerCase() === String(req.user.username || '').toLowerCase()
        );

        if (userIndex !== -1) {
            db.users[userIndex].pushToken = cleanToken;
            db.users[userIndex].pushTokenUpdatedAt = nowIso;
        }

        const tokenRecord = {
            userId: req.user.id,
            username: req.user.username,
            pushToken: cleanToken,
            updatedAt: nowIso
        };

        const existingIndex = db.pushTokens.findIndex(
            item =>
                String(item.username || '').toLowerCase() === String(req.user.username || '').toLowerCase() ||
                item.pushToken === cleanToken
        );

        if (existingIndex !== -1) {
            db.pushTokens[existingIndex] = tokenRecord;
        } else {
            db.pushTokens.push(tokenRecord);
        }

        writeDB(db);
        console.log("[PushToken] Berhasil ditulis ke:", DB_PATH);

        return res.status(200).json({
            message: "Push token berhasil disimpan ke database.json",
            data: tokenRecord
        });
    } catch (error) {
        console.log("[PushToken Error]:", error.message);
        return res.status(500).json({ message: "Gagal menyimpan push token ke database.json" });
    }
});

app.get('/api/push-token', verifyToken, (req, res) => {
    const db = readDB();
    res.status(200).json({ pushTokens: db.pushTokens });
});

app.get('/api/users', verifyToken, (req, res) => {
    try {
        const db = readDB();
        const userList = db.users
            .filter(u => String(u.username || '').toLowerCase() !== String(req.user.username || '').toLowerCase())
            .map(u => ({
                id: u.id,
                username: u.username,
                fullName: u.fullName
            }));
        res.status(200).json(userList);
    } catch (error) {
        res.status(500).json({ message: "Gagal memuat daftar pengguna." });
    }
});

app.get('/api/tasks', verifyToken, (req, res) => {
    try {
        const db = readDB();
        const visibleTasks = db.tasks.filter(task => canUserViewTask(task, req.user));
        res.status(200).json(visibleTasks);
    } catch (error) {
        res.status(500).json({ message: "Terjadi kesalahan pada server saat membaca data." });
    }
});

app.get('/api/stats', verifyToken, (req, res) => {
    try {
        const db = readDB();
        const visibleTasks = db.tasks.filter(task => canUserViewTask(task, req.user));
        const total = visibleTasks.length;
        const completed = visibleTasks.filter(t => Boolean(t.completed)).length;
        res.status(200).json({
            total,
            completed,
            pending: total - completed,
            lastSync: new Date().toLocaleTimeString('id-ID')
        });
    } catch (error) {
        res.status(500).json({ message: "Gagal memuat statistik." });
    }
});

app.post('/api/tasks', verifyToken, (req, res) => {
    if (req.user.role === 'guest') {
        return res.status(403).json({ message: "Akun Guest tidak dapat membuat tugas." });
    }

    const { title, course, deadline, description, imageUri, sensorMeta, invitedUsernames } = req.body;
    if (!title || !course || !deadline) {
        return res.status(400).json({ message: "Judul, mata kuliah, dan tenggat waktu wajib diisi!" });
    }

    const db = readDB();
    let validSharedWith = [];
    if (Array.isArray(invitedUsernames)) {
        invitedUsernames.forEach(rawName => {
            const cleanName = String(rawName).trim();
            if (!cleanName) return;
            const foundUser = db.users.find(
                u => String(u.username || '').toLowerCase() === cleanName.toLowerCase()
            );
            if (
                foundUser &&
                String(foundUser.username || '').toLowerCase() !== String(req.user.username || '').toLowerCase() &&
                !validSharedWith.some(u => String(u || '').toLowerCase() === String(foundUser.username || '').toLowerCase())
            ) {
                validSharedWith.push(foundUser.username);
            }
        });
    }

    const newTask = {
        id: Date.now().toString(),
        title,
        course,
        deadline,
        completed: false,
        description: description || "Tidak ada catatan detail tambahan.",
        imageUri: imageUri || null,
        sensorMeta: sensorMeta || null,
        ownerUsername: req.user.username,
        ownerFullName: req.user.fullName || req.user.username,
        sharedWith: validSharedWith,
        memberLocations: {}
    };

    db.tasks.unshift(newTask);
    writeDB(db);

    res.status(201).json({ message: "Tugas berhasil ditambahkan", task: newTask });
});

app.post('/api/tasks/:id/location', verifyToken, (req, res) => {
    const taskId = req.params.id;
    const { latitude, longitude, accuracy, address } = req.body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ message: "Koordinat latitude dan longitude wajib valid." });
    }

    const db = readDB();
    const taskIndex = db.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex === -1) {
        return res.status(404).json({ message: "Tugas tidak ditemukan!" });
    }

    const task = db.tasks[taskIndex];
    if (!canUserViewTask(task, req.user)) {
        return res.status(403).json({ message: "Anda tidak diundang ke tugas ini." });
    }

    if (!task.memberLocations || typeof task.memberLocations !== 'object') {
        task.memberLocations = {};
    }

    task.memberLocations[String(req.user.username || '').toLowerCase()] = {
        username: req.user.username,
        fullName: req.user.fullName || req.user.username,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address || "Alamat belum tersedia",
        updatedAt: new Date().toLocaleTimeString('id-ID')
    };

    writeDB(db);

    res.status(200).json({
        message: "Lokasi berhasil dibagikan ke anggota yang diundang.",
        task
    });
});

app.post('/api/tasks/:id/invite', verifyToken, (req, res) => {
    const taskId = req.params.id;
    const { usernameToInvite } = req.body;

    if (!usernameToInvite || !String(usernameToInvite).trim()) {
        return res.status(400).json({ message: "Masukkan username teman yang ingin diundang!" });
    }

    const db = readDB();
    const taskIndex = db.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex === -1) {
        return res.status(404).json({ message: "Tugas tidak ditemukan!" });
    }

    const task = db.tasks[taskIndex];
    const isOwner =
        task.ownerUsername &&
        String(task.ownerUsername).toLowerCase() === String(req.user.username || '').toLowerCase();

    if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Hanya pembuat tugas yang dapat mengundang orang lain!" });
    }

    const targetUser = db.users.find(
        u => String(u.username || '').toLowerCase() === String(usernameToInvite).trim().toLowerCase()
    );

    if (!targetUser) {
        return res.status(404).json({ message: `Pengguna dengan username "@${usernameToInvite}" tidak terdaftar!` });
    }

    if (
        task.ownerUsername &&
        String(targetUser.username || '').toLowerCase() === String(task.ownerUsername).toLowerCase()
    ) {
        return res.status(400).json({ message: "Anda tidak dapat mengundang diri sendiri!" });
    }

    if (!Array.isArray(task.sharedWith)) {
        task.sharedWith = [];
    }

    if (task.sharedWith.some(u => String(u || '').toLowerCase() === String(targetUser.username || '').toLowerCase())) {
        return res.status(400).json({ message: `@${targetUser.username} sudah memiliki akses ke tugas ini!` });
    }

    task.sharedWith.push(targetUser.username);
    writeDB(db);

    res.status(200).json({
        message: `@${targetUser.username} berhasil diundang!`,
        task
    });
});

app.delete('/api/tasks/:id/invite/:username', verifyToken, (req, res) => {
    const { id, username } = req.params;
    const db = readDB();

    const taskIndex = db.tasks.findIndex(t => String(t.id) === String(id));
    if (taskIndex === -1) {
        return res.status(404).json({ message: "Tugas tidak ditemukan!" });
    }

    const task = db.tasks[taskIndex];
    const isOwner =
        task.ownerUsername &&
        String(task.ownerUsername).toLowerCase() === String(req.user.username || '').toLowerCase();

    if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Hanya pembuat tugas yang dapat menghapus akses kolaborator!" });
    }

    if (Array.isArray(task.sharedWith)) {
        task.sharedWith = task.sharedWith.filter(
            u => String(u || '').toLowerCase() !== String(username || '').toLowerCase()
        );
    }
    if (task.memberLocations && task.memberLocations[String(username || '').toLowerCase()]) {
        delete task.memberLocations[String(username || '').toLowerCase()];
    }

    writeDB(db);
    res.status(200).json({ message: `Akses @${username} dicabut.`, task });
});

app.patch('/api/tasks/:id', verifyToken, (req, res) => {
    const taskId = req.params.id;
    const { completed } = req.body;
    const db = readDB();

    const taskIndex = db.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex === -1) {
        return res.status(404).json({ message: "Tugas tidak ditemukan!" });
    }

    const task = db.tasks[taskIndex];
    if (!canUserViewTask(task, req.user)) {
        return res.status(403).json({ message: "Anda tidak memiliki akses ke tugas ini!" });
    }

    task.completed = typeof completed === 'boolean' ? completed : !task.completed;
    writeDB(db);

    res.status(200).json({ message: "Status tugas diperbarui", task });
});

app.delete('/api/tasks/:id', verifyToken, (req, res) => {
    const taskId = req.params.id;
    const db = readDB();

    const taskIndex = db.tasks.findIndex(t => String(t.id) === String(taskId));
    if (taskIndex === -1) {
        return res.status(404).json({ message: "Tugas tidak ditemukan!" });
    }

    const task = db.tasks[taskIndex];
    const isOwner =
        task.ownerUsername &&
        String(task.ownerUsername).toLowerCase() === String(req.user.username || '').toLowerCase();

    if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Hanya pembuat tugas yang dapat menghapus tugas ini." });
    }

    db.tasks.splice(taskIndex, 1);
    writeDB(db);

    res.status(200).json({ message: "Tugas berhasil dihapus" });
});

app.listen(3000, "0.0.0.0", () => {
    console.log("Backend server berjalan di port 3000");
    console.log("Target database.json:", DB_PATH);
});
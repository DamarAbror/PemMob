const express = require('express');
const fs = require('fs');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(cors());

const SECRET_KEY = "kunci_rahasia_mydeadline_2026";

const readDB = () => {
    const data = fs.readFileSync('./database.json', 'utf-8');
    return JSON.parse(data);
};

const writeDB = (data) => {
    fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));
};

// Aturan Akses: Tugas hanya bisa dilihat oleh pembuatnya, orang yang di-invite, atau admin
const canUserViewTask = (task, user) => {
    if (!user) return false;
    if (!task.ownerUsername) return true;
    if (user.role === 'guest') return false;

    const currentUsername = user.username.toLowerCase();
    const isOwner = task.ownerUsername.toLowerCase() === currentUsername;
    const isShared =
        Array.isArray(task.sharedWith) &&
        task.sharedWith.some(u => u.toLowerCase() === currentUsername);

    return isOwner || isShared;
};

app.post('/api/register', (req, res) => {
    const { fullName, username, password } = req.body;
    const db = readDB();

    const existingUser = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
        return res.status(400).json({ message: "Username sudah digunakan!" });
    }

    const newUser = {
        id: Date.now().toString(),
        fullName,
        username,
        password,
        role: "user"
    };

    db.users.push(newUser);
    writeDB(db);

    res.status(201).json({ message: "Registrasi berhasil!" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();

    const user = db.users.find(
        u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
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

app.get('/api/users', verifyToken, (req, res) => {
    try {
        const db = readDB();
        const userList = db.users
            .filter(u => u.username.toLowerCase() !== req.user.username.toLowerCase())
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
        return res.status(403).json({ message: "Akun Guest hanya dapat melihat tugas publik." });
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
                u => u.username.toLowerCase() === cleanName.toLowerCase()
            );
            if (
                foundUser &&
                foundUser.username.toLowerCase() !== req.user.username.toLowerCase() &&
                !validSharedWith.some(u => u.toLowerCase() === foundUser.username.toLowerCase())
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
        sharedWith: validSharedWith
    };

    db.tasks.unshift(newTask);
    writeDB(db);

    res.status(201).json({ message: "Tugas berhasil ditambahkan", task: newTask });
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
        task.ownerUsername.toLowerCase() === req.user.username.toLowerCase();

    if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Hanya pembuat tugas yang dapat mengundang orang lain!" });
    }

    const targetUser = db.users.find(
        u => u.username.toLowerCase() === String(usernameToInvite).trim().toLowerCase()
    );

    if (!targetUser) {
        return res.status(404).json({ message: `Pengguna dengan username "@${usernameToInvite}" tidak terdaftar!` });
    }

    if (
        task.ownerUsername &&
        targetUser.username.toLowerCase() === task.ownerUsername.toLowerCase()
    ) {
        return res.status(400).json({ message: "Anda tidak dapat mengundang diri sendiri!" });
    }

    if (!Array.isArray(task.sharedWith)) {
        task.sharedWith = [];
    }

    if (task.sharedWith.some(u => u.toLowerCase() === targetUser.username.toLowerCase())) {
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
        task.ownerUsername.toLowerCase() === req.user.username.toLowerCase();

    if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Hanya pembuat tugas yang dapat menghapus akses kolaborator!" });
    }

    if (Array.isArray(task.sharedWith)) {
        task.sharedWith = task.sharedWith.filter(
            u => u.toLowerCase() !== username.toLowerCase()
        );
        writeDB(db);
    }

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
        task.ownerUsername.toLowerCase() === req.user.username.toLowerCase();

    if (!isOwner && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Hanya pembuat tugas yang dapat menghapus tugas ini." });
    }

    db.tasks.splice(taskIndex, 1);
    writeDB(db);

    res.status(200).json({ message: "Tugas berhasil dihapus" });
});

app.listen(3000, "0.0.0.0", () => {
    console.log("Backend server berjalan di port 3000 (Siap diakses Expo Go)");
});
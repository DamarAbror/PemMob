const express = require('express');
const fs = require('fs');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = "kunci_rahasia_mydeadline_2026";

const readDB = () => {
    const data = fs.readFileSync('./database.json', 'utf-8');
    return JSON.parse(data);
};

const writeDB = (data) => {
    fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));
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

    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) {
        return res.status(401).json({ message: "Username atau password salah!" });
    }

    const tokenPayload = { id: user.id, username: user.username, role: user.role };
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
        req.user = { id: "guest", username: "guest", role: "user" };
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

app.get('/api/tasks', verifyToken, (req, res) => {
    const db = readDB();
    res.json(db.tasks);
});

app.post('/api/tasks', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Akses ditolak! Anda bukan admin." });
    }

    const { title, course, deadline } = req.body;
    if (!title || !course || !deadline) {
        return res.status(400).json({ message: "Semua data tugas wajib diisi!" });
    }

    const db = readDB();
    const newTask = {
        id: Date.now().toString(),
        title,
        course,
        deadline
    };

    db.tasks.unshift(newTask);
    writeDB(db);

    res.status(201).json({ message: "Tugas berhasil ditambahkan", task: newTask });
});

app.listen(3000, () => {
    console.log("Backend server berjalan di http://localhost:3000");
});
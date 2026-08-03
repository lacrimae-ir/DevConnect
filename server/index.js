import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Setup database tables if they don't exist
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    
    // Add new columns if they don't exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url VARCHAR(255);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_pic_url VARCHAR(255);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;`);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        text TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // If table already exists without is_read, add it
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;`);
    
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database', err);
  }
};

initDb();

// Setup Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, password] // Note: In production, password should be hashed!
    );
    res.status(201).json({ message: 'User created successfully', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ message: 'Login successful', user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// Get User Profile
app.get('/api/user/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, username, bio, banner_url, profile_pic_url, skills FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let user = result.rows[0];
    if (!user.username) {
      const generatedUsername = 'user' + Math.floor(Math.random() * 10000000);
      await pool.query('UPDATE users SET username = $1 WHERE id = $2', [generatedUsername, req.params.id]);
      user.username = generatedUsername;
    }
    
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update User Profile
app.put('/api/user/:id', async (req, res) => {
  const { username, bio, banner_url, profile_pic_url, skills } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET 
        username = COALESCE($1, username),
        bio = COALESCE($2, bio),
        banner_url = COALESCE($3, banner_url),
        profile_pic_url = COALESCE($4, profile_pic_url),
        skills = COALESCE($5, skills)
      WHERE id = $6 RETURNING id, email, username, bio, banner_url, profile_pic_url, skills`,
      [username, bio, banner_url, profile_pic_url, skills ? JSON.stringify(skills) : null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Profile updated', user: result.rows[0] });
    // Broadcast updated users to clients
    broadcastUsers();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat History Endpoint
app.get('/api/chat-history/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    // Get unique users who have exchanged messages with this user, and their unread count
    const result = await pool.query(`
      SELECT u.id, u.username, u.profile_pic_url, u.last_seen,
             SUM(CASE WHEN m.receiver_id = $1 AND m.sender_id = u.id AND m.is_read = false THEN 1 ELSE 0 END) as unread_count
      FROM users u
      JOIN messages m ON (u.id = m.sender_id OR u.id = m.receiver_id)
      WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND u.id != $1
      GROUP BY u.id
    `, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Messages Endpoint
app.get('/api/messages/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    
    // Mark incoming messages from user2 to user1 as read
    await pool.query(`
      UPDATE messages 
      SET is_read = true 
      WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false
    `, [user1, user2]);

    const result = await pool.query(`
      SELECT * FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
    `, [user1, user2]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.IO logic
let activeUsers = new Map(); // socket.id -> userId

const broadcastOnlineUsers = () => {
  const onlineUserIds = Array.from(new Set(activeUsers.values()));
  io.emit('online_users', onlineUserIds);
};

const broadcastUsers = async () => {
  try {
    // Get all users to send to clients
    const result = await pool.query('SELECT id, email, username, profile_pic_url, last_seen FROM users');
    io.emit('users_list', result.rows);
  } catch (err) {
    console.error('Error fetching users for broadcast', err);
  }
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('user_connected', (userId) => {
    activeUsers.set(socket.id, userId);
    broadcastUsers();
    broadcastOnlineUsers();
  });

  socket.on('send_message', async (data) => {
    // data should contain { senderId, receiverId, text }
    try {
      const result = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, text, is_read) VALUES ($1, $2, $3, false) RETURNING *',
        [data.senderId, data.receiverId, data.text]
      );
      const savedMessage = result.rows[0];
      io.emit('receive_message', savedMessage);
    } catch (err) {
      console.error('Error saving message', err);
    }
  });

  socket.on('mark_read', async ({ senderId, receiverId }) => {
    try {
      await pool.query(
        'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
        [senderId, receiverId]
      );
    } catch (err) {
      console.error('Error marking read', err);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const userId = activeUsers.get(socket.id);
    if (userId) {
      try {
        await pool.query('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        // Also broadcast the new last_seen via users_list
        broadcastUsers();
      } catch (err) {
        console.error('Error updating last_seen', err);
      }
    }
    activeUsers.delete(socket.id);
    broadcastOnlineUsers();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

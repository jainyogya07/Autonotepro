require('dotenv').config();
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const socketIo = require('socket.io');

// Import database connection and models
const connectDB = require('./database/connection');
const User = require('./models/User');
const Notebook = require('./models/Notebook');
const Note = require('./models/Note');

// Import routes
const authRoutes = require('./routes/auth');
const notebookRoutes = require('./routes/notebooks');
const noteRoutes = require('./routes/notes');
const { optionalAuth } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
connectDB();

// Initialize Socket.io with robust timeouts
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' },
  pingTimeout: 60000, // 60s to detect disconnect
  pingInterval: 25000 // 25s keep-alive
});

// ... (existing code)

// Chat Message with Acknowledgment
socket.on('send-chat-message', async ({ notebookId, message, user }, callback) => {
  try {
    const chatMsg = {
      user,
      message,
      timestamp: new Date()
    };

    // Broadcast to everyone (including sender, for simple consistency, though sender might optimistic UI)
    // Actually, standard is broadcast to others, and Ack to sender. 
    // Current logic: io.to(...) emits to everyone including sender.
    // Let's keep broadcasting to everyone to simplify "received by server" state on client.
    io.to(`notebook-${notebookId}`).emit('chat-message', chatMsg);

    // Save to DB
    await Notebook.findByIdAndUpdate(notebookId, {
      $push: { chat: { user: user.id || user._id, message } }
    });

    // Acknowledge success to sender
    if (typeof callback === 'function') {
      callback({ status: 'ok' });
    }

  } catch (err) {
    console.error('Error saving chat:', err);
    if (typeof callback === 'function') {
      callback({ status: 'error', message: 'Failed to send' });
    }
  }
});

// Track note locks: { noteId: { socketId, user, timestamp, notebookId } }
const noteLocks = {};

// Helper to remove user from all rooms
const removeUserFromRooms = (socketId) => {
  let affectedNotebooks = [];

  for (const [notebookId, users] of Object.entries(activeUsers)) {
    const initialLength = users.length;
    activeUsers[notebookId] = users.filter(u => u.socketId !== socketId);

    if (activeUsers[notebookId].length < initialLength) {
      affectedNotebooks.push(notebookId);
    }

    // Cleanup empty rooms
    if (activeUsers[notebookId].length === 0) {
      delete activeUsers[notebookId];
    }
  }
  return affectedNotebooks;
};

// Helper to release locks held by a user
const releaseUserLocks = (socketId) => {
  const releasedNotes = [];
  for (const [noteId, lock] of Object.entries(noteLocks)) {
    if (lock.socketId === socketId) {
      delete noteLocks[noteId];
      releasedNotes.push({ noteId, notebookId: lock.notebookId });
    }
  }
  return releasedNotes;
};

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Join notebook room
  socket.on('join-notebook', ({ notebookId, user }) => {
    socket.join(`notebook-${notebookId}`);
    // console.log(`User ${user ? user.name : 'Anon'} (${socket.id}) joined notebook ${notebookId}`);

    // Initialize room if not exists
    if (!activeUsers[notebookId]) {
      activeUsers[notebookId] = [];
    }

    // Add user if not already in (prevent duplicates)
    const existingUserIndex = activeUsers[notebookId].findIndex(u => u.socketId === socket.id);
    if (existingUserIndex === -1) {
      activeUsers[notebookId].push({
        socketId: socket.id,
        user: user || { name: 'Anonymous', _id: 'anon' }
      });
    }

    // Notify others in the room
    socket.to(`notebook-${notebookId}`).emit('user-joined', {
      socketId: socket.id,
      user: user,
      timestamp: new Date()
    });

    // Send current active users to the joining user
    socket.emit('room-users', activeUsers[notebookId]);

    // Send current locks for this notebook
    const notebookLocks = Object.entries(noteLocks)
      .filter(([_, lock]) => lock.notebookId === notebookId)
      .map(([noteId, lock]) => ({ noteId, user: lock.user }));

    if (notebookLocks.length > 0) {
      socket.emit('active-locks', notebookLocks);
    }

    // Send chat history
    try {
      Notebook.findById(notebookId).populate('chat.user', 'name avatar').then(notebook => {
        if (notebook && notebook.chat) {
          const recentChat = notebook.chat.slice(-50); // Last 50 messages
          socket.emit('notebook-chat-history', recentChat);
        }
      }).catch(err => console.error('Error fetching chat:', err));
    } catch (err) {
      console.error('Chat history error:', err);
    }
  });

  // Leave notebook room
  socket.on('leave-notebook', (notebookId) => {
    socket.leave(`notebook-${notebookId}`);
    // console.log(`User ${socket.id} left notebook ${notebookId}`);

    // Remove from tracking
    if (activeUsers[notebookId]) {
      activeUsers[notebookId] = activeUsers[notebookId].filter(u => u.socketId !== socket.id);
      if (activeUsers[notebookId].length === 0) delete activeUsers[notebookId];
    }

    socket.to(`notebook-${notebookId}`).emit('user-left', {
      socketId: socket.id
    });
  });

  // Chat Message
  socket.on('send-chat-message', async ({ notebookId, message, user }) => {
    try {
      const chatMsg = {
        user,
        message,
        timestamp: new Date()
      };

      // Broadcast to everyone (including sender)
      io.to(`notebook-${notebookId}`).emit('chat-message', chatMsg);

      // Save to DB
      await Notebook.findByIdAndUpdate(notebookId, {
        $push: { chat: { user: user.id || user._id, message } }
      });
    } catch (err) {
      console.error('Error saving chat:', err);
    }
  });

  // Note Locking
  socket.on('request-edit-lock', ({ notebookId, noteId, user }) => {
    if (noteLocks[noteId]) {
      if (noteLocks[noteId].socketId === socket.id) {
        // Already locked by this user, re-confirm
        socket.emit('lock-granted', { noteId });
        return;
      }
      // Locked by someone else
      socket.emit('lock-denied', { noteId, user: noteLocks[noteId].user });
    } else {
      // Lock it
      noteLocks[noteId] = {
        socketId: socket.id,
        user,
        notebookId,
        timestamp: Date.now()
      };
      socket.emit('lock-granted', { noteId });
      socket.to(`notebook-${notebookId}`).emit('note-locked', { noteId, user });
    }
  });

  socket.on('release-edit-lock', ({ notebookId, noteId }) => {
    if (noteLocks[noteId] && noteLocks[noteId].socketId === socket.id) {
      delete noteLocks[noteId];
      socket.to(`notebook-${notebookId}`).emit('note-unlocked', { noteId });
    }
  });


  // Note being edited (real-time indicator)
  socket.on('note-editing', ({ notebookId, noteId, user }) => {
    socket.to(`notebook-${notebookId}`).emit('note-editing', {
      noteId,
      user,
      socketId: socket.id
    });
  });

  // Note updated
  socket.on('note-updated', ({ notebookId, note }) => {
    socket.to(`notebook-${notebookId}`).emit('note-updated', note);
  });

  // Note created
  socket.on('note-created', ({ notebookId, note }) => {
    socket.to(`notebook-${notebookId}`).emit('note-created', note);
  });

  // Note deleted
  socket.on('note-deleted', ({ notebookId, noteId }) => {
    socket.to(`notebook-${notebookId}`).emit('note-deleted', noteId);
  });

  // Backward compatibility events
  socket.on('noteAdded', () => {
    io.emit('refreshNotes');
  });

  socket.on('disconnect', () => {
    console.log('⚠️ User disconnected:', socket.id);

    // Cleanup Rooms
    const affectedNotebooks = removeUserFromRooms(socket.id);
    affectedNotebooks.forEach(notebookId => {
      socket.to(`notebook-${notebookId}`).emit('user-left', {
        socketId: socket.id
      });
    });

    // Cleanup Locks
    const releasedNotes = releaseUserLocks(socket.id);
    releasedNotes.forEach(({ noteId, notebookId }) => {
      socket.to(`notebook-${notebookId}`).emit('note-unlocked', { noteId });
    });
  });
});

// Make io available to routes
app.set('io', io);

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'AutonotePro API',
    version: '2.0.0',
    features: ['Authentication', 'Shared Notebooks', 'Real-time Collaboration'],
    status: 'running'
  });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/notebooks', notebookRoutes);
// Notes routes are nested under notebooks (e.g. /notebooks/:id/notes)
app.use('/', noteRoutes); // Mount at root so /notebooks/:id/notes works

// Legacy routes for backward compatibility (will be deprecated)
app.get('/notes-legacy', async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 }).limit(100);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// AI Summarization (existing feature)
app.post('/summarize', async (req, res) => {
  const { text } = req.body;
  const HF_TOKEN = process.env.HF_TOKEN;

  if (!HF_TOKEN) {
    return res.json({ summary: 'HuggingFace API token not configured. Add HF_TOKEN to .env file.' });
  }

  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      { inputs: text },
      {
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`
        }
      }
    );
    res.json({ summary: response.data[0].summary_text });
  } catch (error) {
    console.error('Summarization error:', error.message);
    res.json({ summary: 'Summary service unavailable. Please try again later.' });
  }
});

// GitHub Backup (existing feature)
app.post('/backup', optionalAuth, async (req, res) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    return res.status(400).json({
      success: false,
      message: 'GitHub token not configured. Add GITHUB_TOKEN to .env file.'
    });
  }

  try {
    // Export user's notes
    let notes;
    if (req.user) {
      // Get all notebooks user has access to
      const notebooks = await Notebook.find({
        $or: [
          { owner: req.user._id },
          { 'members.user': req.user._id }
        ]
      });

      const notebookIds = notebooks.map(n => n._id);
      notes = await Note.find({ notebook: { $in: notebookIds } });
    } else {
      notes = await Note.find().limit(100);
    }

    const gistData = {
      description: 'AutonotePro Backup',
      public: false,
      files: {
        'notes.json': {
          content: JSON.stringify(notes, null, 2)
        }
      }
    };

    const response = await axios.post(
      'https://api.github.com/gists',
      gistData,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ success: true, url: response.data.html_url });
  } catch (error) {
    console.error('Backup error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
server.listen(port, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 AutonotePro Backend v2.0`);
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Server running at http://localhost:${port}`);
  console.log(`✅ Real-time collaboration enabled`);
  console.log(`✅ Authentication enabled`);
  console.log(`\n📋 Features:`);
  console.log(`   - JWT Authentication`);
  console.log(`   - Shared Notebooks`);
  console.log(`   - Real-time Collaboration`);
  console.log(`   - AI Summarization ${process.env.HF_TOKEN ? '✅' : '⚠️  (disabled)'}`);
  console.log(`   - GitHub Backup ${process.env.GITHUB_TOKEN ? '✅' : '⚠️  (disabled)'}`);
  console.log(`\n🔐 Default Login:`);
  console.log(`   Email: user@autonotepro.local`);
  console.log(`   Password: password123`);
  console.log(`   ⚠️  Change this password after first login!`);
  console.log(`\n${'='.repeat(50)}\n`);
});
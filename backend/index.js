require('dotenv').config();
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

const NOTES_FILE = 'notes.json';

// Load notes from file
let notes = [];
try {
  if (fsSync.existsSync(NOTES_FILE)) {
    const data = fsSync.readFileSync(NOTES_FILE, 'utf-8');
    notes = JSON.parse(data);

    // Migration: Add IDs to existing notes if they don't have them
    let needsMigration = false;
    notes = notes.map((note) => {
      if (!note.id) {
        needsMigration = true;
        return {
          id: uuidv4(),
          text: note.text || note,
          tags: note.tags || [],
          timestamp: note.timestamp || new Date().toISOString(),
          pinned: note.pinned || false
        };
      }
      return note;
    });

    if (needsMigration) {
      fsSync.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
      console.log('✅ Migrated existing notes to UUID format');
    }
  }
} catch (e) {
  console.error('Error loading notes:', e);
  notes = [];
}

// Save notes to file (async)
async function saveNotes() {
  try {
    await fs.writeFile(NOTES_FILE, JSON.stringify(notes, null, 2));
  } catch (error) {
    console.error('Error saving notes:', error);
    throw error;
  }
}

// Initialize Socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('noteAdded', () => {
    io.emit('refreshNotes');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Routes
app.get('/', (req, res) => {
  res.send('Autonote Pro backend running');
});

app.get('/notes', (req, res) => {
  res.json(notes);
});

app.post('/notes', async (req, res) => {
  const { note, tags } = req.body;
  if (note) {
    const newNote = {
      id: uuidv4(),
      text: note,
      tags: tags || [],
      timestamp: new Date().toISOString(),
      pinned: false
    };
    notes.push(newNote);

    try {
      await saveNotes();
      io.emit('refreshNotes');
      res.json({ success: true, note: newNote });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to save note.' });
    }
  } else {
    res.status(400).json({ success: false, message: 'Note text missing.' });
  }
});

app.delete('/notes/:id', async (req, res) => {
  const { id } = req.params;
  const index = notes.findIndex(note => note.id === id);

  if (index >= 0) {
    notes.splice(index, 1);
    try {
      await saveNotes();
      io.emit('refreshNotes');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to delete note.' });
    }
  } else {
    res.status(404).json({ success: false, message: 'Note not found.' });
  }
});

app.put('/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { note, tags } = req.body;
  const index = notes.findIndex(n => n.id === id);

  if (index >= 0 && note) {
    notes[index].text = note;
    notes[index].tags = tags || notes[index].tags;
    notes[index].timestamp = new Date().toISOString();

    try {
      await saveNotes();
      io.emit('refreshNotes');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update note.' });
    }
  } else {
    res.status(404).json({ success: false, message: 'Note not found or invalid request.' });
  }
});

app.post('/notes/:id/pin', async (req, res) => {
  const { id } = req.params;
  const index = notes.findIndex(note => note.id === id);

  if (index >= 0) {
    notes[index].pinned = !notes[index].pinned;
    try {
      await saveNotes();
      io.emit('refreshNotes');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to pin note.' });
    }
  } else {
    res.status(404).json({ success: false });
  }
});

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

app.post('/backup', async (req, res) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    return res.status(400).json({
      success: false,
      message: 'GitHub token not configured. Add GITHUB_TOKEN to .env file.'
    });
  }

  try {
    const gistData = {
      description: 'Autonote Pro Backup',
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

// Start server
server.listen(port, () => {
  console.log(`✅ Backend server running at http://localhost:${port}`);
  console.log(`📝 Notes file: ${NOTES_FILE}`);
  if (!process.env.HF_TOKEN) {
    console.log('⚠️  HF_TOKEN not set - AI summarization disabled');
  }
  if (!process.env.GITHUB_TOKEN) {
    console.log('⚠️  GITHUB_TOKEN not set - Cloud backup disabled');
  }
});
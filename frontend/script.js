// ========================================
// AUTONOTE PRO - FRONTEND SCRIPT (Refactored)
// ========================================

// API Configuration
const API_URL = 'http://localhost:8080';

// DOM Elements
const saveBtn = document.getElementById('saveBtn');
const noteInput = document.getElementById('noteInput');
const notesArea = document.getElementById('notesArea');
const searchInput = document.getElementById('searchInput');
const tagsInput = document.getElementById('tagsInput');
const exportBtn = document.getElementById('exportBtn');
const darkModeBtn = document.getElementById('darkModeBtn');
const sortBtn = document.getElementById('sortBtn');
const charCount = document.getElementById('charCount');
const voiceBtn = document.getElementById('voiceBtn');
const summarizeBtn = document.getElementById('summarizeBtn');
const backupBtn = document.getElementById('backupBtn');
const analyticsBtn = document.getElementById('analyticsBtn');
const analyticsPanel = document.getElementById('analyticsPanel');
const analyticsContent = document.getElementById('analyticsContent');

// Modal Elements
const modalContainer = document.getElementById('modalContainer');
const modalTitle = document.getElementById('modalTitle');
const modalInput = document.getElementById('modalInput');
const modalTagsInput = document.getElementById('modalTagsInput');
const modalSaveBtn = document.getElementById('modalSaveBtn');

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// MODAL FUNCTIONS
// ========================================
let currentEditId = null;

function openModal(id, note) {
  currentEditId = id;
  modalTitle.textContent = 'Edit Note';
  modalInput.value = note.text;
  modalTagsInput.value = note.tags ? note.tags.join(', ') : '';
  modalContainer.classList.remove('hidden');
}

function closeModal() {
  modalContainer.classList.add('hidden');
  currentEditId = null;
  modalInput.value = '';
  modalTagsInput.value = '';
}

// Global functions for inline handlers
window.closeModal = closeModal;
window.formatText = formatText;

// ========================================
// FETCH NOTES FROM BACKEND
// ========================================
async function fetchNotes(query = '') {
  try {
    const res = await fetch(`${API_URL}/notes`);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    let notes = await res.json();

    // Sort: pinned notes first
    notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    // Filter by search query if provided
    if (query) {
      notes = notes.filter(note => {
        const text = note.text.toLowerCase();
        const tags = note.tags ? note.tags.join(' ').toLowerCase() : '';
        return text.includes(query) || tags.includes(query);
      });
    }

    renderNotes(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    notesArea.innerHTML = '<p style="color: var(--neon-pink); text-align: center; padding: 2rem;">⚠️ Error loading notes. Is backend running?</p>';
  }
}

// ========================================
// RENDER NOTES TO PAGE
// ========================================
function renderNotes(notes) {
  notesArea.innerHTML = '';

  if (notes.length === 0) {
    notesArea.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No notes yet. Start creating!</p>';
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement('div');
    card.className = `note-card ${note.pinned ? 'pinned' : ''}`;

    const tagsHTML = note.tags && note.tags.length > 0
      ? `<div class="note-tags">${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
      : '';

    const pinIcon = note.pinned ? '📌 ' : '';
    const timestamp = note.timestamp ? new Date(note.timestamp).toLocaleDateString() : '';

    card.innerHTML = `
      <div class="note-header">
        <div class="note-title">${pinIcon}Note</div>
      </div>
      <div class="note-content">${note.text}</div>
      ${tagsHTML}
      <div class="note-meta">${timestamp}</div>
      <div class="note-actions">
        <button class="note-btn" onclick="pinNote('${note.id}')">
          ${note.pinned ? '📌 Unpin' : '📌 Pin'}
        </button>
        <button class="note-btn" onclick="editNote('${note.id}')">✏️ Edit</button>
        <button class="note-btn" onclick="deleteNote('${note.id}')">🗑️ Delete</button>
      </div>
    `;

    notesArea.appendChild(card);
  });
}

// ========================================
// SAVE NOTE
// ========================================
saveBtn.onclick = async () => {
  const note = noteInput.innerText.trim();
  const tags = tagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t);

  if (!note) {
    showToast('Please write a note first!', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.classList.add('loading');

  try {
    const res = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, tags })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    if (data.success) {
      noteInput.innerText = '';
      tagsInput.value = '';
      charCount.textContent = '0 characters';
      await fetchNotes();
      showToast('Note saved successfully!', 'success');
    } else {
      showToast('Failed to save note: ' + data.message, 'error');
    }
  } catch (error) {
    console.error('Error saving note:', error);
    showToast('Error saving note. Check backend connection!', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.classList.remove('loading');
  }
};

// ========================================
// DELETE NOTE
// ========================================
async function deleteNote(id) {
  if (!confirm('Are you sure you want to delete this note?')) return;

  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    await fetchNotes();
    showToast('Note deleted!', 'success');
  } catch (error) {
    console.error('Error deleting note:', error);
    showToast('Error deleting note', 'error');
  }
}
window.deleteNote = deleteNote;

// ========================================
// EDIT NOTE
// ========================================
async function editNote(id) {
  try {
    const res = await fetch(`${API_URL}/notes`);
    const notes = await res.json();
    const note = notes.find(n => n.id === id);

    if (!note) {
      showToast('Note not found', 'error');
      return;
    }

    openModal(id, note);
  } catch (error) {
    console.error('Error fetching note:', error);
    showToast('Error loading note', 'error');
  }
}
window.editNote = editNote;

// Modal Save Handler
modalSaveBtn.onclick = async () => {
  if (!currentEditId) return;

  const newNote = modalInput.value.trim();
  const tags = modalTagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t);

  if (!newNote) {
    showToast('Note cannot be empty', 'error');
    return;
  }

  modalSaveBtn.disabled = true;
  modalSaveBtn.classList.add('loading');

  try {
    const res = await fetch(`${API_URL}/notes/${currentEditId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: newNote, tags })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    closeModal();
    await fetchNotes();
    showToast('Note updated!', 'success');
  } catch (error) {
    console.error('Error editing note:', error);
    showToast('Error updating note', 'error');
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.classList.remove('loading');
  }
};

// ========================================
// PIN NOTE
// ========================================
async function pinNote(id) {
  try {
    const res = await fetch(`${API_URL}/notes/${id}/pin`, {
      method: 'POST'
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    await fetchNotes();
  } catch (error) {
    console.error('Error pinning note:', error);
    showToast('Error pinning note', 'error');
  }
}
window.pinNote = pinNote;

// ========================================
// SEARCH NOTES
// ========================================
if (searchInput) {
  searchInput.oninput = () => {
    const query = searchInput.value.toLowerCase();
    fetchNotes(query);
  };
}

// ========================================
// EXPORT NOTES
// ========================================
if (exportBtn) {
  exportBtn.onclick = async () => {
    try {
      const res = await fetch(`${API_URL}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');

      const notes = await res.json();
      const text = notes
        .map((n, i) => `${i + 1}. ${n.text}
Tags: ${n.tags ? n.tags.join(', ') : 'None'}
Date: ${n.timestamp ? new Date(n.timestamp).toLocaleDateString() : 'N/A'}

`)
        .join('');

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autonote-pro-export-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Notes exported!', 'success');
    } catch (error) {
      console.error('Error exporting notes:', error);
      showToast('Failed to export notes', 'error');
    }
  };
}

// ========================================
// DARK MODE
// ========================================
if (darkModeBtn) {
  darkModeBtn.onclick = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    const icon = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
    darkModeBtn.querySelector('.icon').textContent = icon;
  };

  // Load dark mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    darkModeBtn.querySelector('.icon').textContent = '☀️';
  }
}

// ========================================
// SORT BY DATE
// ========================================
if (sortBtn) {
  let sortOrder = 'desc';
  sortBtn.onclick = async () => {
    try {
      const res = await fetch(`${API_URL}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');

      let notes = await res.json();

      notes.sort((a, b) => {
        const dateA = new Date(a.timestamp || 0);
        const dateB = new Date(b.timestamp || 0);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });

      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      renderNotes(notes);
      showToast(`Sorted by ${sortOrder === 'asc' ? 'oldest' : 'newest'} first`, 'info');
    } catch (error) {
      console.error('Error sorting notes:', error);
      showToast('Error sorting notes', 'error');
    }
  };
}

// ========================================
// CHARACTER COUNT
// ========================================
if (charCount && noteInput) {
  noteInput.oninput = () => {
    charCount.textContent = `${noteInput.innerText.length} characters`;
  };
}

// ========================================
// VOICE INPUT
// ========================================
if (voiceBtn) {
  voiceBtn.onclick = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('Voice input not supported in your browser', 'error');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      showToast('Listening... speak now!', 'info');
      voiceBtn.disabled = true;
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      noteInput.innerText = transcript;
      charCount.textContent = `${noteInput.innerText.length} characters`;
      showToast('Voice input captured!', 'success');
    };

    recognition.onerror = (event) => {
      showToast('Voice recognition error: ' + event.error, 'error');
    };

    recognition.onend = () => {
      voiceBtn.disabled = false;
    };

    recognition.start();
  };
}

// ========================================
// SUMMARIZE NOTE
// ========================================
if (summarizeBtn) {
  summarizeBtn.onclick = async () => {
    const text = noteInput.innerText.trim();
    if (text.length < 50) {
      showToast('Note too short to summarize! Add more text (min 50 characters)', 'error');
      return;
    }

    summarizeBtn.disabled = true;
    summarizeBtn.classList.add('loading');

    try {
      showToast('Summarizing...', 'info');
      const res = await fetch(`${API_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!res.ok) throw new Error('Summarization failed');

      const data = await res.json();

      // Show summary in a better way
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'glass-panel';
      summaryDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 500px; padding: 2rem; z-index: 1000;';
      summaryDiv.innerHTML = `
        <h3 style="margin-bottom: 1rem;">📋 AI Summary</h3>
        <p style="line-height: 1.6; margin-bottom: 1rem;">${data.summary}</p>
        <button class="btn btn-primary" onclick="this.parentElement.remove()">Close</button>
      `;
      document.body.appendChild(summaryDiv);
    } catch (error) {
      console.error('Error summarizing:', error);
      showToast('Summarization failed. Check backend!', 'error');
    } finally {
      summarizeBtn.disabled = false;
      summarizeBtn.classList.remove('loading');
    }
  };
}

// ========================================
// BACKUP NOTES TO GITHUB
// ========================================
if (backupBtn) {
  backupBtn.onclick = async () => {
    backupBtn.disabled = true;
    backupBtn.classList.add('loading');

    try {
      showToast('Creating backup...', 'info');
      const res = await fetch(`${API_URL}/backup`, { method: 'POST' });

      if (!res.ok) throw new Error('Backup failed');

      const data = await res.json();
      if (data.success) {
        showToast('Backup successful!', 'success');
        setTimeout(() => {
          window.open(data.url, '_blank');
        }, 1000);
      } else {
        showToast('Backup failed: ' + data.message, 'error');
      }
    } catch (error) {
      console.error('Error backing up:', error);
      showToast('Backup failed. Check backend!', 'error');
    } finally {
      backupBtn.disabled = false;
      backupBtn.classList.remove('loading');
    }
  };
}

// ========================================
// ANALYTICS
// ========================================
if (analyticsBtn) {
  analyticsBtn.onclick = async () => {
    try {
      const res = await fetch(`${API_URL}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');

      const notes = await res.json();

      if (notes.length === 0) {
        analyticsContent.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No notes to analyze yet!</p>';
        analyticsPanel.classList.remove('hidden');
        return;
      }

      const totalNotes = notes.length;
      const totalWords = notes.reduce((sum, n) => {
        const text = n.text.split(' ').length;
        return sum + text;
      }, 0);
      const avgWordsPerNote = totalNotes > 0 ? (totalWords / totalNotes).toFixed(2) : 0;
      const allTags = notes.flatMap(n => n.tags || []);
      const tagCounts = {};
      allTags.forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
      const topTag = Object.keys(tagCounts).length > 0
        ? Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a])[0]
        : 'None';

      analyticsContent.innerHTML = `
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value">${totalNotes}</div>
            <div class="stat-label">Total Notes</div>
          </div>
          <div class="stat-card" style="background: var(--gradient-secondary);">
            <div class="stat-value">${totalWords}</div>
            <div class="stat-label">Total Words</div>
          </div>
          <div class="stat-card" style="background: var(--gradient-success);">
            <div class="stat-value">${avgWordsPerNote}</div>
            <div class="stat-label">Avg Words/Note</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${topTag}</div>
            <div class="stat-label">Top Tag</div>
          </div>
        </div>
      `;
      analyticsPanel.classList.remove('hidden');
    } catch (error) {
      console.error('Error fetching analytics:', error);
      showToast('Analytics failed', 'error');
    }
  };
}

function closeAnalytics() {
  analyticsPanel.classList.add('hidden');
}
window.closeAnalytics = closeAnalytics;

// ========================================
// FORMAT TEXT (RICH EDITOR)
// ========================================
function formatText(command) {
  document.execCommand(command, false, null);
}

// ========================================
// SOCKET.IO (REAL-TIME SYNC)
// ========================================
try {
  const socket = io(`${API_URL}`);

  socket.on('connect', () => {
    console.log('✅ Connected to backend via Socket.io');
  });

  socket.on('refreshNotes', () => {
    console.log('📢 Refreshing notes from real-time update...');
    fetchNotes();
  });

  socket.on('disconnect', () => {
    console.log('⚠️ Disconnected from backend');
  });
} catch (error) {
  console.warn('⚠️ Socket.io not available (optional feature):', error);
}

// ========================================
// INITIAL LOAD
// ========================================
fetchNotes();
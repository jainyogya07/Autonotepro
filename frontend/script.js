// ========================================
// AUTONOTE PRO v2.0 - COLLABORATIVE EDITION
// ========================================

// Import auth utilities
const { API_URL, fetchWithAuth, getCurrentUser } = window.auth;

// State Management
let currentNotebook = null;
let currentNotebookId = null;
let notebooks = [];
let notes = [];

let socket = null;
let activeUsers = [];
let typingTimeout = null;
let lockedNotes = new Set(); // IDs of notes locked by others

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
const modalContainer = document.getElementById('modalContainer');
const modalTitle = document.getElementById('modalTitle');
const modalInput = document.getElementById('modalInput');
const modalTagsInput = document.getElementById('modalTagsInput');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const notebookList = document.getElementById('notebookList');
const newNotebookBtn = document.getElementById('newNotebookBtn');
const currentNotebookDisplay = document.getElementById('currentNotebook');
const currentNotebookName = document.getElementById('currentNotebookName');
const shareNotebookBtn = document.getElementById('shareNotebookBtn');

// ========================================
// INITIALIZATION
// ========================================
async function initialize() {
  try {
    showToast('Loading your workspace...', 'info');

    await loadNotebooks();
    initializeSocket();

    // Load dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
      if (darkModeBtn) darkModeBtn.querySelector('.icon').textContent = '☀️';
    }

  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Failed to initialize. Please refresh.', 'error');
  }
}

// ========================================
// NOTEBOOKS  MANAGEMENT
// ========================================
async function loadNotebooks() {
  try {
    const response = await fetchWithAuth(`${API_URL}/notebooks`);
    const data = await response.json();

    if (!data.success) throw new Error(data.message);

    notebooks = data.notebooks;
    renderNotebooks();

    if (notebooks.length > 0 && !currentNotebookId) {
      selectNotebook(notebooks[0]._id);
    } else if (notebooks.length === 0) {
      showToast('Create your first notebook to get started!', 'info');
    }

  } catch (error) {
    console.error('Error loading notebooks:', error);
    showToast('Failed to load notebooks', 'error');
  }
}

function renderNotebooks() {
  if (!notebookList) return;

  notebookList.innerHTML = '';

  notebooks.forEach(notebook => {
    const item = document.createElement('div');
    item.className = `notebook-item ${notebook._id === currentNotebookId ? 'active' : ''}`;
    item.onclick = () => selectNotebook(notebook._id);

    const isOwner = notebook.owner._id === getCurrentUser().id;
    const member = notebook.members.find(m => m.user._id === getCurrentUser().id);
    const role = isOwner ? 'Owner' : (member ? member.role : 'Unknown');

    item.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span class="notebook-item-icon">${notebook.icon || '📓'}</span>
        <div>
          <div class="notebook-item-title">${notebook.title}</div>
          <div class="notebook-item-role">${role}</div>
        </div>
      </div>
    `;

    notebookList.appendChild(item);
  });
}

async function selectNotebook(notebookId) {
  try {
    currentNotebookId = notebookId;
    currentNotebook = notebooks.find(n => n._id === notebookId);

    if (!currentNotebook) throw new Error('Notebook not found');

    renderNotebooks();
    currentNotebookDisplay.style.display = 'block';
    currentNotebookName.textContent = currentNotebook.title;

    if (socket) {
      socket.emit('join-notebook', {
        notebookId,
        user: getCurrentUser()
      });
    }

    await loadNotesForNotebook(notebookId);
    showToast(`Switched to "${currentNotebook.title}"`, 'info');

    // Reset active users UI until server responds
    renderActiveUsers([]);

    if (window.innerWidth < 1024) {
      document.getElementById('notebookSidebar').classList.remove('open');
    }

  } catch (error) {
    console.error('Error selecting notebook:', error);
    showToast('Failed to switch notebook', 'error');
  }
}

async function loadNotesForNotebook(notebookId) {
  try {
    const response = await fetchWithAuth(`${API_URL}/notebooks/${notebookId}/notes`);
    const data = await response.json();

    if (!data.success) throw new Error(data.message);

    notes = data.notes || [];
    renderNotes(notes);

  } catch (error) {
    console.error('Error loading notes:', error);
    showToast('Failed to load notes', 'error');
  }
}

// ========================================
// SOCKET.IO - REAL-TIME COLLABORATION
// ========================================
function initializeSocket() {
  try {
    socket = io(API_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    // Connection Status handling
    const statusEl = document.getElementById('connectionStatus');

    socket.on('connect_error', (err) => {
      console.log('Connection Error:', err);
      if (statusEl) {
        statusEl.style.backgroundColor = 'orange';
        statusEl.title = 'Connection Issue...';
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      if (statusEl) {
        statusEl.style.backgroundColor = 'orange';
        statusEl.title = `Reconnecting (Attempt ${attempt})...`;
      }
      showToast(`Reconnecting... (${attempt})`, 'info');
    });

    socket.on('connect', () => {
      console.log('✅ Real-time collaboration enabled');
      if (statusEl) {
        statusEl.style.backgroundColor = 'var(--success-color)';
        statusEl.title = 'Connected';
      }

      if (currentNotebookId) {
        socket.emit('join-notebook', {
          notebookId: currentNotebookId,
          user: getCurrentUser()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Disconnected');
      if (statusEl) {
        statusEl.style.backgroundColor = 'var(--error-color)';
        statusEl.title = 'Disconnected';
      }
    });

    socket.on('reconnect', () => {
      console.log('🔄 Reconnected');
      if (statusEl) {
        statusEl.style.backgroundColor = 'var(--success-color)';
        statusEl.title = 'Connected';
      }
    });

    // Presence events
    socket.on('room-users', (users) => {
      activeUsers = users || [];
      renderActiveUsers(activeUsers);
    });

    socket.on('user-joined', ({ socketId, user }) => {
      if (!activeUsers.find(u => u.socketId === socketId)) {
        activeUsers.push({ socketId, user });
        renderActiveUsers(activeUsers);
        showToast(`👋 ${user ? user.name : 'Someone'} joined`, 'info');
      }
    });

    socket.on('user-left', ({ socketId }) => {
      activeUsers = activeUsers.filter(u => u.socketId !== socketId);
      renderActiveUsers(activeUsers);
    });

    // Note events
    socket.on('note-created', (note) => {
      notes.push(note);
      renderNotes(notes);
      showToast('📝 New note from collaborator', 'info');
    });

    socket.on('note-updated', (updatedNote) => {
      const index = notes.findIndex(n => n._id === updatedNote._id);
      if (index >= 0) {
        notes[index] = updatedNote;
        renderNotes(notes);
        // showToast('✏️ Note updated by collaborator', 'info'); // Optional to reduce noise
      }
    });

    socket.on('note-deleted', (noteId) => {
      notes = notes.filter(n => n._id !== noteId);
      renderNotes(notes);
      showToast('🗑️ Note deleted by collaborator', 'info');
    });

    // Typing indicators
    socket.on('note-editing', ({ noteId, user }) => {
      showTypingIndicator(noteId, user);
    });

    // Locking Events
    socket.on('active-locks', (locks) => {
      locks.forEach(({ noteId, user }) => {
        lockedNotes.add(noteId);
        updateNoteLockUI(noteId, true, user);
      });
    });

    socket.on('note-locked', ({ noteId, user }) => {
      lockedNotes.add(noteId);
      updateNoteLockUI(noteId, true, user);
      showToast(`${user.name} started editing a note`, 'info');
    });

    socket.on('note-unlocked', ({ noteId }) => {
      lockedNotes.delete(noteId);
      updateNoteLockUI(noteId, false);
    });

    socket.on('lock-denied', ({ user }) => {
      showToast(`Note is currently being edited by ${user.name}`, 'error');
      closeModal(); // Force close if opened optimistically, or prevent opening
    });

    socket.on('lock-granted', ({ noteId }) => {
      // Lock obtained, safe to edit
      // Logic handled in editNote usually, but good to know
    });

    socket.on('refreshNotes', () => currentNotebookId && loadNotesForNotebook(currentNotebookId));

    // Chat Events
    socket.on('notebook-chat-history', (history) => {
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) {
        chatMessages.innerHTML = '';
        history.forEach(msg => appendChatMessage(msg));
        scrollToBottom();
      }
    });

    socket.on('chat-message', (msg) => {
      appendChatMessage(msg);
      scrollToBottom();

      const sidebar = document.getElementById('chatSidebar');
      if (sidebar && sidebar.style.display === 'none') {
        // Optional: Notification dot
      }
    });

  } catch (error) {
    console.warn('⚠️ Socket.io not available:', error);
  }
}

// ========================================
// PRESENCE & COLLABORATION UI
// ========================================
function renderActiveUsers(users) {
  const container = document.getElementById('activeUsersList');
  if (!container) return;

  container.innerHTML = '';

  // Filter out self if needed, or show all. Usually show all including self is fine, 
  // or show others. Let's show others to avoid confusion, or all.
  // Showing all gives confirmation "I am connected".

  users.forEach((u, index) => {
    // Unique color generation based on name
    const name = u.user ? u.user.name : '?';
    const initial = name.charAt(0).toUpperCase();
    const color = stringToColor(name);

    const avatar = document.createElement('div');
    avatar.className = 'user-avatar-small';
    avatar.style.cssText = `
      width: 28px; 
      height: 28px; 
      border-radius: 50%; 
      background-color: ${color}; 
      color: white; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-size: 0.75rem; 
      border: 2px solid var(--glass-bg); 
      margin-left: -8px;
      position: relative;
    `;
    avatar.textContent = initial;
    avatar.title = name;

    // Tooltip
    // avatar.dataset.tooltip = name;

    container.appendChild(avatar);
  });
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function showTypingIndicator(noteId, user) {
  // Find the note card in DOM
  // Since we don't have IDs on card elements easily, we might need to re-render or add ID to card.
  // Best approach: add data-id to note cards in renderNotes first.
  const card = document.querySelector(`.note-card[data-id="${noteId}"]`);
  if (card) {
    let indicator = card.querySelector('.typing-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      indicator.style.cssText = `
        font-size: 0.75rem; 
        color: var(--neon-purple); 
        margin-top: 0.5rem; 
        font-style: italic;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      card.appendChild(indicator);
    }

    indicator.textContent = `${user.name} is typing...`;
    indicator.style.opacity = '1';

    // Clear after timeout
    clearTimeout(card.typingTimeout);
    card.typingTimeout = setTimeout(() => {
      indicator.style.opacity = '0';
    }, 2000);
  }
}

// ========================================
// NOTES CRUD OPERATIONS
// ========================================
async function saveNote() {
  if (!currentNotebookId) {
    showToast('Please select a notebook first', 'error');
    return;
  }

  const note = noteInput.innerText.trim();
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

  if (!note) {
    showToast('Please write a note first!', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.classList.add('loading');

  try {
    const response = await fetchWithAuth(`${API_URL}/notebooks/${currentNotebookId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note, tags })
    });

    const data = await response.json();
    if (data.success) {
      noteInput.innerText = '';
      tagsInput.value = '';
      charCount.textContent = '0 characters';

      if (socket) socket.emit('note-created', { notebookId: currentNotebookId, note: data.note });

      await loadNotesForNotebook(currentNotebookId);
      showToast('Note saved successfully!', 'success');
    } else {
      showToast(data.message || 'Failed to save note', 'error');
    }
  } catch (error) {
    console.error('Error saving note:', error);
    showToast('Error saving note. Check your connection!', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.classList.remove('loading');
  }
}

window.deleteNote = async (id) => {
  if (!confirm('Delete this note? This cannot be undone.')) return;

  try {
    const response = await fetchWithAuth(`${API_URL}/notes/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      if (socket) socket.emit('note-deleted', { notebookId: currentNotebookId, noteId: id });
      await loadNotesForNotebook(currentNotebookId);
      showToast('Note deleted!', 'success');
    } else {
      showToast(data.message || 'Failed to delete note', 'error');
    }
  } catch (error) {
    console.error('Error deleting note:', error);
    showToast('Error deleting note!', 'error');
  }
};

let currentEditId = null;

window.editNote = (id) => {
  if (lockedNotes.has(id)) {
    showToast('This note is currently locked by another user.', 'error');
    return;
  }

  const note = notes.find(n => n._id === id);
  if (!note) return;

  // Request Lock
  if (socket) {
    socket.emit('request-edit-lock', {
      notebookId: currentNotebookId,
      noteId: id,
      user: getCurrentUser()
    });
  }

  currentEditId = id;
  modalTitle.textContent = 'Edit Note';
  modalInput.value = note.text;
  modalTagsInput.value = note.tags ? note.tags.join(', ') : '';
  modalContainer.classList.remove('hidden');
};

modalSaveBtn.onclick = async () => {
  if (!currentEditId) return;

  const note = modalInput.value.trim();
  const tags = modalTagsInput.value.split(',').map(t => t.trim()).filter(t => t);

  if (!note) {
    showToast('Note cannot be empty!', 'error');
    return;
  }

  modalSaveBtn.disabled = true;

  try {
    const response = await fetchWithAuth(`${API_URL}/notes/${currentEditId}`, {
      method: 'PUT',
      body: JSON.stringify({ note, tags })
    });

    const data = await response.json();
    if (data.success) {
      if (socket) socket.emit('note-updated', { notebookId: currentNotebookId, note: data.note });
      await loadNotesForNotebook(currentNotebookId);
      closeModal();
      showToast('Note updated!', 'success');
    } else {
      showToast(data.message || 'Failed to update note', 'error');
    }
  } catch (error) {
    console.error('Error updating note:', error);
    showToast('Error updating note!', 'error');
  } finally {
    modalSaveBtn.disabled = false;
  }
};

window.pinNote = async (id) => {
  try {
    const response = await fetchWithAuth(`${API_URL}/notes/${id}/pin`, { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      await loadNotesForNotebook(currentNotebookId);
      showToast(data.message || 'Note pinned!', 'success');
    } else {
      showToast(data.message || 'Failed to pin note', 'error');
    }
  } catch (error) {
    console.error('Error pinning note:', error);
    showToast('Error pinning note!', 'error');
  }
};

// ========================================
// RENDER NOTES
// ========================================
function renderNotes(notesToRender) {
  notesArea.innerHTML = '';

  if (notesToRender.length === 0) {
    notesArea.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">No notes yet. Start creating!</p>';
    return;
  }

  notesToRender.forEach((note) => {
    const card = document.createElement('div');
    card.className = `note-card ${note.pinned ? 'pinned' : ''}`;
    card.dataset.id = note._id; // Add ID for easy access

    const tagsHTML = note.tags && note.tags.length > 0
      ? `<div class="note-tags">${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
      : '';

    const pinIcon = note.pinned ? '📌 ' : '';
    const timestamp = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : '';
    const author = note.author ? note.author.name : 'Unknown';

    card.innerHTML = `
      <div class="note-header">
        <div class="note-title">${pinIcon}Note</div>
      </div>
      <div class="note-content">${note.text}</div>
      ${tagsHTML}
      <div class="note-meta">
        ${timestamp} • by ${author}
      </div>
      <div class="note-actions">
        <button class="note-btn" onclick="pinNote('${note._id}')">
          ${note.pinned ? '📌 Unpin' : '📌 Pin'}
        </button>
        <button class="note-btn note-btn-edit" onclick="editNote('${note._id}')">✏️ Edit</button>
        <button class="note-btn" onclick="deleteNote('${note._id}')">🗑️ Delete</button>
      </div>
    `;

    notesArea.appendChild(card);
  });
}

// ========================================
// UI UTILITIES
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

function closeModal() {
  if (currentEditId && socket && currentNotebookId) {
    socket.emit('release-edit-lock', {
      notebookId: currentNotebookId,
      noteId: currentEditId
    });
  }

  modalContainer.classList.add('hidden');
  currentEditId = null;
  modalInput.value = '';
  modalTagsInput.value = '';
}

function closeAnalytics() {
  analyticsPanel.classList.add('hidden');
}

window.closeModal = closeModal;
window.closeAnalytics = closeAnalytics;

// Text formatting
window.formatText = (command) => {
  document.execCommand(command);
  noteInput.focus();
};

// ========================================
// SEARCH & FILTER
// ========================================
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = notes.filter(note =>
    note.text.toLowerCase().includes(query) ||
    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
  );
  renderNotes(filtered);
});

// ========================================
// EXPORT & BACKUP
// ========================================
exportBtn.onclick = () => {
  const data = JSON.stringify(notes, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autonote-${currentNotebook?.title || 'notes'}-${Date.now()}.json`;
  a.click();
  showToast('Notes exported!', 'success');
};

backupBtn.onclick = async () => {
  backupBtn.disabled = true;
  try {
    const response = await fetchWithAuth(`${API_URL}/backup`, { method: 'POST' });
    const data = await response.json();
    if (data.success) {
      showToast('Backup created! Opening...', 'success');
      window.open(data.url, '_blank');
    } else {
      showToast(data.message || 'Backup failed', 'error');
    }
  } catch (error) {
    showToast('Backup failed!', 'error');
  } finally {
    backupBtn.disabled = false;
  }
};

// ========================================
// DARK MODE
// ========================================
darkModeBtn.onclick = () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
  darkModeBtn.querySelector('.icon').textContent = isDark ? '☀️' : '🌙';
  showToast(`${isDark ? 'Dark' : 'Light'} mode activated!`, 'info');
};

// ========================================
// ANALYTICS
// ========================================
analyticsBtn.onclick = () => {
  const totalNotes = notes.length;
  const pinnedNotes = notes.filter(n => n.pinned).length;
  const allTags = notes.flatMap(n => n.tags || []);
  const uniqueTags = [...new Set(allTags)];
  const avgLength = notes.length > 0
    ? Math.round(notes.reduce((sum, n) => sum + n.text.length, 0) / notes.length)
    : 0;

  analyticsContent.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${totalNotes}</div><div class="stat-label">Total Notes</div></div>
      <div class="stat-card" style="background: var(--gradient-secondary);"><div class="stat-value">${pinnedNotes}</div><div class="stat-label">Pinned</div></div>
      <div class="stat-card" style="background: var(--gradient-success);"><div class="stat-value">${uniqueTags.length}</div><div class="stat-label">Unique Tags</div></div>
      <div class="stat-card"><div class="stat-value">${avgLength}</div><div class="stat-label">Avg Length</div></div>
    </div>
    <h4 style="margin-top: 2rem; margin-bottom: 1rem;">Notebook: ${currentNotebook?.title || 'None'}</h4>
    <p style="color: var(--text-secondary);">Owner: ${currentNotebook?.owner?.name || 'Unknown'}</p>
    <p style="color: var(--text-secondary);">Members: ${currentNotebook?.members?.length || 0}</p>
  `;
  analyticsPanel.classList.remove('hidden');
};

// ========================================
// CHARACTER COUNT
// ========================================
noteInput.addEventListener('input', () => {
  charCount.textContent = `${noteInput.innerText.length} characters`;

  // Collaborative typing indicator
  // Note: Since this is a new note (not saved yet), we don't have an ID.
  // Logic works better for EDITING existing notes.
  // For new notes, maybe we don't show typing? Or we need a temporary ID?
  // Let's implement for EDITING existing notes in the modal.
});

// Add input listener to modal for editing existing notes
modalInput.addEventListener('input', () => {
  if (currentEditId && socket && currentNotebookId) {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      // Debounce slightly if needed, but for "is typing" we usually send immediately then throttle
    }, 500);

    // Throttle emission
    if (!modalInput.lastEmit || Date.now() - modalInput.lastEmit > 1000) {
      socket.emit('note-editing', {
        notebookId: currentNotebookId,
        noteId: currentEditId,
        user: getCurrentUser()
      });
      modalInput.lastEmit = Date.now();
    }
  }
});

// ========================================
// CREATE NEW NOTEBOOK
// ========================================
if (newNotebookBtn) {
  newNotebookBtn.onclick = async () => {
    const title = prompt('Enter notebook name:');
    if (!title) return;

    try {
      const response = await fetchWithAuth(`${API_URL}/notebooks`, {
        method: 'POST',
        body: JSON.stringify({ title })
      });

      const data = await response.json();
      if (data.success) {
        await loadNotebooks();
        showToast('Notebook created!', 'success');
      } else {
        showToast(data.message || 'Failed to create notebook', 'error');
      }
    } catch (error) {
      showToast('Error creating notebook!', 'error');
    }
  };
}

// ========================================
// SHARE NOTEBOOK
// ========================================
if (shareNotebookBtn) {
  shareNotebookBtn.onclick = async () => {
    const email = prompt('Enter email address to share with:');
    if (!email) return;

    const role = prompt('Role (viewer/editor/admin):') || 'viewer';

    try {
      const response = await fetchWithAuth(`${API_URL}/notebooks/${currentNotebookId}/share`, {
        method: 'POST',
        body: JSON.stringify({ email, role })
      });

      const data = await response.json();
      if (data.success) {
        showToast(`Notebook shared with ${email}!`, 'success');
        await loadNotebooks();
      } else {
        showToast(data.message || 'Failed to share notebook', 'error');
      }
    } catch (error) {
      showToast('Error sharing notebook!', 'error');
    }
  };
}

// ========================================
// EVENT LISTENERS
// ========================================
saveBtn.onclick = saveNote;

saveBtn.onclick = saveNote;

// Tab UI
window.switchTab = (tab) => {
  const chatPanel = document.getElementById('chatPanel');
  const activityPanel = document.getElementById('activityPanel');
  const tabChat = document.getElementById('tab-chat');
  const tabActivity = document.getElementById('tab-activity');

  if (tab === 'chat') {
    chatPanel.style.display = 'flex';
    activityPanel.style.display = 'none';
    tabChat.style.background = 'var(--gradient-primary)';
    tabChat.style.color = 'white';
    tabActivity.style.background = 'transparent';
    tabActivity.style.color = 'var(--text-primary)';
    scrollToBottom();
  } else {
    chatPanel.style.display = 'none';
    activityPanel.style.display = 'block';
    tabActivity.style.background = 'var(--gradient-primary)';
    tabActivity.style.color = 'white';
    tabChat.style.background = 'transparent';
    tabChat.style.color = 'var(--text-primary)';
  }
};

function appendActivityItem(item, prepend = false) {
  const list = document.getElementById('activityList');
  if (!list) return;

  const div = document.createElement('div');
  div.style.cssText = `
        padding: 0.75rem;
        background: var(--glass-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-size: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    `;

  // Icon based on action
  let icon = '📢';
  if (item.action.includes('created')) icon = '✨';
  if (item.action.includes('deleted')) icon = '🗑️';
  if (item.action.includes('updated')) icon = '✏️';
  if (item.action.includes('joined')) icon = '👋';

  div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--text-primary);">${item.user.name || 'Unknown'}</strong>
            <span style="font-size: 0.7rem; color: var(--text-secondary);">${new Date(item.timestamp).toLocaleTimeString()}</span>
        </div>
        <div style="color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
            <span>${icon}</span>
            <span>${item.action} <em>${item.targetTitle || ''}</em></span>
        </div>
    `;

  if (prepend) list.prepend(div);
  else list.appendChild(div);
}

// Chat UI Functions
window.toggleChat = () => {
  const sidebar = document.getElementById('chatSidebar');
  if (sidebar) {
    sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
    if (sidebar.style.display === 'flex') {
      scrollToBottom();
    }
  }
};

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (message && socket && currentNotebookId) {
    const user = getCurrentUser();
    // Optimistic UI clear
    input.value = '';

    // Send with Ack
    socket.emit('send-chat-message', {
      notebookId: currentNotebookId,
      message,
      user
    }, (response) => {
      if (response.status !== 'ok') {
        showToast('Failed to send message', 'error');
        input.value = message; // Restore text
      } else {
        // console.log('Message delivered');
      }
    });
  }
}

function appendChatMessage(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const user = getCurrentUser();
  const isMe = msg.user._id === user._id || msg.user.id === user._id || msg.user === user._id;

  const div = document.createElement('div');
  div.style.cssText = `
        display: flex; 
        flex-direction: column; 
        align-items: ${isMe ? 'flex-end' : 'flex-start'}; 
        margin-bottom: 0.5rem;
    `;

  let headerHtml = '';
  if (!isMe && msg.user.name) {
    headerHtml = `<span style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 2px;">${msg.user.name}</span>`;
  }

  let timeStr = '';
  try { timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { }

  div.innerHTML = `
        ${headerHtml}
        <div style="
            background: ${isMe ? 'var(--gradient-primary)' : 'var(--glass-bg)'};
            color: ${isMe ? 'white' : 'var(--text-primary)'};
            padding: 0.5rem 0.8rem;
            border-radius: 12px;
            border-top-${isMe ? 'right' : 'left'}-radius: 2px;
            max-width: 85%;
            word-wrap: break-word;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        ">
            ${msg.message}
        </div>
        <span style="font-size: 0.6rem; color: var(--text-secondary); margin-top: 2px;">${timeStr}</span>
    `;
  container.appendChild(div);
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) container.scrollTop = container.scrollHeight;
}

// Add Chat Input Listeners
const sendChatBtn = document.getElementById('sendChatBtn');
if (sendChatBtn) sendChatBtn.onclick = sendChatMessage;

const chatInput = document.getElementById('chatInput');
if (chatInput) {
  chatInput.onkeypress = (e) => {
    if (e.key === 'Enter') sendChatMessage();
  };
}

function updateNoteLockUI(noteId, isLocked, user) {
  const card = document.querySelector(`.note-card[data-id="${noteId}"]`);
  if (!card) return;

  const btn = card.querySelector('.note-btn-edit');
  const meta = card.querySelector('.note-meta');

  if (isLocked) {
    if (btn) {
      btn.disabled = true;
      btn.title = `Locked by ${user.name}`;
      btn.innerHTML = '🔒 Editing...';
    }
    if (meta && !meta.querySelector('.lock-msg')) {
      const msg = document.createElement('span');
      msg.className = 'lock-msg';
      msg.style.color = 'var(--neon-purple)';
      msg.style.marginLeft = '0.5rem';
      msg.textContent = `(Edited by ${user.name})`;
      meta.appendChild(msg);
    }
  } else {
    if (btn) {
      btn.disabled = false;
      btn.title = 'Edit Note';
      btn.innerHTML = '✏️ Edit';
    }
    const msg = meta ? meta.querySelector('.lock-msg') : null;
    if (msg) msg.remove();
  }
}

// Initialize on load
initialize();
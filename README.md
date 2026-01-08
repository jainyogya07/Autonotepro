# ✨ AutonotePro

> A modern, feature-rich note-taking application with AI-powered summarization, real-time sync, and a stunning Glassmorphism UI design.

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://autonote-pro-demo.netlify.app)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![AutonotePro Banner](/docs/screenshots/banner.png)

## ✨ Features

### 📝 Core Features
- **Rich Text Editor** - Format your notes with bold, italic, and underline
- **Smart Tagging** - Organize notes with flexible tag system
- **Quick Search** - Real-time search across all notes and tags
- **Pin Important Notes** - Keep critical notes at the top
- **Sort & Filter** - Organize by date or custom criteria

### 🚀 Advanced Features
- **🎤 Voice Input** - Dictate notes using speech recognition
- **✨ AI Summarization** - Generate concise summaries powered by HuggingFace
- **☁️ Cloud Backup** - Backup to GitHub Gists automatically
- **📊 Analytics Dashboard** - Track your note-taking statistics
- **🌙 Dark Mode** - Easy on the eyes with beautiful dark theme
- **⚡ Real-time Sync** - Live updates across multiple tabs via Socket.io

### 🎨 Modern UI/UX
- **Glassmorphism Design** - Premium frosted-glass aesthetic
- **Neon Color Palette** - Vibrant gradients and smooth animations
- **Fully Responsive** - Perfect on desktop, tablet, and mobile
- **Custom Modals & Toasts** - Professional UI components
- **Smooth Animations** - Delightful micro-interactions

## 🖼️ Screenshots

<table>
  <tr>
    <td><img src="/docs/screenshots/light-mode.png" alt="Light Mode" width="400"/></td>
    <td><img src="/docs/screenshots/dark-mode.png" alt="Dark Mode" width="400"/></td>
  </tr>
  <tr>
    <td align="center"><b>Light Mode</b></td>
    <td align="center"><b>Dark Mode</b></td>
  </tr>
</table>

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 14.0.0
- **npm** >= 6.0.0

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jainyogya07/AutonotePro.git
   cd AutonotePro
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure environment variables** (Optional - for AI features)
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. **Start the backend server**
   ```bash
   npm start
   ```
   The backend will run on `http://localhost:8080`

5. **Open the frontend**
   - Open `frontend/index.html` in your browser
   - Or use a local server:
     ```bash
     cd frontend
     npx serve .
     ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Port (default: 8080)
PORT=8080

# HuggingFace API Token for AI Summarization
# Get your token from: https://huggingface.co/settings/tokens
HF_TOKEN=your_huggingface_token_here

# GitHub Personal Access Token for Cloud Backup
# Get your token from: https://github.com/settings/tokens
# Required scope: gist
GITHUB_TOKEN=your_github_token_here
```

### Getting API Keys

#### HuggingFace Token (for AI Summarization)
1. Go to [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create a new token with read access
3. Copy and paste it into your `.env` file

#### GitHub Token (for Cloud Backup)
1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate new token (classic)
3. Select the `gist` scope
4. Copy and paste it into your `.env` file

> **Note:** The app works perfectly without these API keys. AI Summarization and Cloud Backup features will be disabled if keys are not provided.

## 📁 Project Structure

```
AutonotePro/
├── backend/
│   ├── index.js           # Express server with Socket.io
│   ├── package.json       # Backend dependencies
│   ├── notes.json         # Local data storage
│   ├── .env.example       # Environment template
│   └── .env               # Your config (not committed)
├── frontend/
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Glassmorphism styles
│   └── script.js          # Frontend logic
├── docs/
│   └── screenshots/       # UI screenshots
├── README.md
├── LICENSE
└── .gitignore
```

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - Real-time bidirectional communication
- **UUID** - Unique ID generation
- **Axios** - HTTP client for API calls

### Frontend
- **Vanilla JavaScript** - No frameworks for maximum performance
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Grid, Flexbox
- **Socket.io Client** - Real-time updates
- **Web Speech API** - Voice input

### External APIs
- **HuggingFace** - AI text summarization
- **GitHub Gists** - Cloud backup storage

## 🎨 Design System

### Color Palette
- **Neon Purple**: `#a855f7`
- **Neon Pink**: `#ec4899`
- **Neon Blue**: `#3b82f6`
- **Neon Cyan**: `#06b6d4`
- **Neon Green**: `#10b981`

### Typography
- **Font Family**: Inter (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700

## 📖 API Documentation

### Endpoints

#### `GET /notes`
Get all notes
```json
Response: [
  {
    "id": "uuid-string",
    "text": "Note content",
    "tags": ["tag1", "tag2"],
    "timestamp": "2026-01-08T10:00:00.000Z",
    "pinned": false
  }
]
```

#### `POST /notes`
Create a new note
```json
Request: {
  "note": "Note content",
  "tags": ["tag1", "tag2"]
}
Response: {
  "success": true,
  "note": { /* created note object */ }
}
```

#### `PUT /notes/:id`
Update a note
```json
Request: {
  "note": "Updated content",
  "tags": ["new-tag"]
}
```

#### `DELETE /notes/:id`
Delete a note

#### `POST /notes/:id/pin`
Toggle pin status

#### `POST /summarize`
Generate AI summary
```json
Request: {
  "text": "Long text to summarize..."
}
Response: {
  "summary": "Generated summary"
}
```

#### `POST /backup`
Create GitHub Gist backup
```json
Response: {
  "success": true,
  "url": "https://gist.github.com/..."
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Known Issues

- Voice input requires HTTPS in production (browser security)
- AI Summarization requires HuggingFace API key
- Cloud Backup requires GitHub token with gist scope

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Yogya Jain**
- GitHub: [@jainyogya07](https://github.com/jainyogya07)

## 🙏 Acknowledgments

- Design inspiration from modern Glassmorphism UI trends
- Icons from Unicode emoji set
- Fonts from Google Fonts
- AI models from HuggingFace

## 📧 Support

If you have any questions or need help, please open an issue on GitHub.

---

<p align="center">Made with ❤️ by Yogya Jain</p>

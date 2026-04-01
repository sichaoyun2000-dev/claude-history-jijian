# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Install Dependencies
```bash
npm run install:all      # Install both frontend and backend dependencies
npm run install:server   # Install only backend dependencies
npm run install:client   # Install only frontend dependencies
```

### Start Development
```bash
./start.sh               # One-click startup script (recommended)
npm run start            # Install dependencies and start both services
npm run start:dev        # Start both services without reinstalling dependencies
npm run start:server     # Start only backend server (port 3333)
npm run start:client     # Start only frontend dev server (port 5173)
```

### Build
```bash
npm run build:client     # Build frontend for production
cd client && npm run type-check  # Type check TypeScript
```

## Code Architecture

### Overview
This is a **local B/S architecture application** that browses and manages Claude Code's local conversation history stored on your Mac. It reads from Claude Code's native storage (`~/.claude.json` and `~/.claude/projects/`) and provides a visual web interface.

### Backend (`server/index.js`)
- **Framework**: Node.js + Express 5.x
- **CORS**: Enabled for all origins (local development only)
- **Data Source**: Reads directly from the local file system where Claude Code stores its data

**API Endpoints**:
- `GET /api/projects` - Get list of all projects from `~/.claude.json`
- `GET /api/sessions?path=<project-path>` - Get list of sessions for a project
- `GET /api/session-detail?filePath=<session-file-path>` - Get full parsed conversation with tool calls
- `GET /api/search?q=<query>` - Full-text search across all conversation content
- `GET /api/stats` - Get statistics (total projects/sessions, project distribution, contribution heatmap, recent sessions)
- `GET /api/security/scan` - Scan conversation history for sensitive information (API keys, tokens, passwords, etc.)

**Data Format**: Claude Code stores conversations as JSONL files, one line per message. The backend parses this into a clean message format with role (user/assistant), content, and tool calls.

### Frontend (`client/`)
- **Framework**: Vue 3 (Composition API) + TypeScript
- **Build Tool**: Vite
- **UI Library**: Element Plus
- **Markdown Rendering**: marked + highlight.js for code highlighting

**Components** (`client/src/components/`):
- `ActivityStats.vue` - Overview statistics cards
- `ContributionGraph.vue` - GitHub-style contribution calendar heatmap
- `MarkdownRenderer.vue` - Markdown + syntax highlighting rendering
- `ProjectPieChart.vue` - Pie chart of session distribution by project
- `RecentSessions.vue` - List of recently modified sessions
- `TrendChart.vue` - Line chart of conversation trends over time

**Main App**: `client/src/App.vue` - Single-file component containing the entire application state and layout (three-pane: projects/sessions/conversation)

**Key Features**:
- Global full-text search with keyboard shortcuts (Cmd+K)
- Collapsible tool call viewing
- Keyboard navigation
- Dark theme by default

## Node.js Version Requirements
- Node.js: `^20.19.0 || >=22.12.0` (required by Vite and Vue 3)

## Default Ports
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3333`

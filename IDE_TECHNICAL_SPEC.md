# Persevere IDE - Technical Specification

## Executive Summary

Persevere IDE is a VS Code OSS-based IDE that enables autonomous software development through cloud-first architecture. The IDE provides a conversational AI avatar interface, real-time project execution, and works seamlessly offline while the cloud agent continues development independently.

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Persevere IDE (Client)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Tavus      │  │     Chat     │  │  Execution   │     │
│  │   Avatar     │  │    Panel     │  │   Summary    │     │
│  │  (Draggable) │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         VS Code OSS Core (Forked)                    │   │
│  │  - Editor, Extensions, Language Support              │   │
│  │  - File System, Terminal, Debugging                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Offline Sync Layer                           │   │
│  │  - Local State Cache                                 │   │
│  │  - Action Queue (for offline operations)             │   │
│  │  - Background Sync Service                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ (WebSocket/HTTP)
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Services (Backend)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   API        │  │   Cloud      │  │  Supabase    │     │
│  │  (Fastify)   │  │   Runner     │  │  (Database)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │   Tavus      │  │  Digital   │                          │
│  │   API        │  │  Ocean     │                          │
│  │              │  │  Spaces    │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. IDE Client (VS Code OSS Fork)

**Base**: VS Code Open Source (https://github.com/microsoft/vscode)

**Customizations**:
- Custom branding (Persevere logo, colors, name)
- Custom activity bar icons and panels
- Draggable widget system for Tavus avatar
- Custom command palette entries
- Modified welcome screen
- Custom status bar items

**Key Files to Modify**:
- `src/vs/workbench/workbench.desktop.main.ts` - Main entry point
- `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts` - Activity bar
- `src/vs/workbench/browser/parts/sidebar/sidebarPart.ts` - Sidebar panels
- `product.json` - Product branding
- `package.json` - Product metadata

### 2. Custom Features

#### A. Tavus Meeting Integration

**Location**: `src/persevere/meeting/`

**Components**:
- `meetingWidget.ts` - Draggable avatar widget
- `meetingPanel.ts` - Meeting panel in sidebar
- `meetingService.ts` - Service for Tavus API integration
- `meetingView.ts` - React component for meeting UI

**Features**:
- Draggable avatar card (can be positioned anywhere)
- Embedded Tavus conversation iframe
- Meeting state management (active/inactive)
- Transcript capture and display
- Project selection before meeting
- Meeting history

**Technical Details**:
- Uses VS Code's webview API for iframe embedding
- Custom drag-and-drop implementation using VS Code's DOM utilities
- State persisted in workspace storage
- CSP configured for Tavus domains

#### B. Chat Panel

**Location**: `src/persevere/chat/`

**Components**:
- `chatPanel.ts` - Chat panel in sidebar
- `chatService.ts` - Service for chat API integration
- `chatView.ts` - React component for chat UI
- `messageRenderer.ts` - Message rendering with markdown support

**Features**:
- Real-time chat with cloud agent
- Project context awareness
- Code snippet support
- Markdown rendering
- Message history
- Typing indicators

**Technical Details**:
- WebSocket connection for real-time updates
- Message queue for offline mode
- Context injection (current file, selection, project structure)

#### C. Execution Summary Panel

**Location**: `src/persevere/execution/`

**Components**:
- `executionPanel.ts` - Execution panel in sidebar
- `executionService.ts` - Service for job API integration
- `executionView.ts` - React component for timeline
- `timelineRenderer.ts` - Timeline visualization
- `artifactViewer.ts` - Artifact viewer (logs, test reports)

**Features**:
- Real-time job timeline
- Step-by-step execution logs
- Test results visualization
- Build output display
- PR preview and links
- Artifact downloads
- Job status indicators

**Technical Details**:
- WebSocket/SSE for real-time updates
- Virtual scrolling for large timelines
- Syntax highlighting for logs
- File diff viewer integration

#### D. Offline Sync Layer

**Location**: `src/persevere/sync/`

**Components**:
- `syncService.ts` - Main sync service
- `localCache.ts` - Local state cache
- `actionQueue.ts` - Action queue for offline operations
- `backgroundSync.ts` - Background sync worker

**Features**:
- Local state caching
- Action queue (create job, send message, etc.)
- Background sync when connection restored
- Conflict resolution
- Optimistic UI updates

**Technical Details**:
- IndexedDB for local storage
- Service Worker for background sync (optional)
- Conflict resolution strategy (last-write-wins with user confirmation)
- Sync status indicator in status bar

### 3. Cloud Services Integration

#### API Client

**Location**: `src/persevere/api/`

**Components**:
- `apiClient.ts` - Main API client
- `authService.ts` - Authentication service
- `projectService.ts` - Project management
- `jobService.ts` - Job management
- `websocketClient.ts` - WebSocket client for real-time updates

**Features**:
- Automatic token management
- Request/response interceptors
- Retry logic with exponential backoff
- Offline mode detection
- Request queuing

#### Authentication

**Flow**:
1. User opens IDE
2. If not authenticated, show login screen
3. Device code flow (same as extension)
4. Store token in secure storage
5. Auto-refresh tokens

**Storage**:
- Tokens stored in VS Code's secure storage (OS keychain)
- Refresh tokens handled automatically
- Session persistence across IDE restarts

### 4. Project Management

#### New Project Flow

1. User clicks "New Project" or opens meeting
2. Tavus meeting starts
3. User discusses requirements with avatar
4. AI extracts: goal, acceptance criteria, tech stack, time budget
5. User approves spec
6. Cloud agent starts working
7. IDE shows execution summary

#### Existing Project Flow

1. User opens/clones existing project
2. IDE detects project structure
3. Agent analyzes codebase
4. User can start meeting to discuss modifications
5. Agent adapts to existing structure

#### Tech Stack Detection

**Supported Methods**:
- `package.json` (Node.js)
- `requirements.txt` / `Pipfile` (Python)
- `Cargo.toml` (Rust)
- `pom.xml` / `build.gradle` (Java)
- `go.mod` (Go)
- `composer.json` (PHP)
- `Gemfile` (Ruby)
- And more...

**Detection Service**: `src/persevere/project/detector.ts`

## Data Flow

### Meeting → Job Creation Flow

```
1. User starts meeting in IDE
   ↓
2. IDE → API: POST /projects/:id/meetings
   ↓
3. API → Tavus: Create conversation
   ↓
4. Tavus → API: Webhook (transcript ready)
   ↓
5. API → LLM: Extract spec from transcript
   ↓
6. API → Database: Create job with spec
   ↓
7. API → Cloud Runner: Trigger job execution
   ↓
8. IDE ← API: WebSocket event (job created)
   ↓
9. IDE: Show job in Execution Summary
```

### Offline Operation Flow

```
1. User performs action (create job, send message)
   ↓
2. IDE checks connection status
   ↓
3. If offline:
   - Store action in queue
   - Show optimistic UI update
   - Display "Offline" indicator
   ↓
4. When connection restored:
   - Background sync service processes queue
   - Actions sent to API in order
   - UI updates with real data
   - Show sync completion notification
```

## Technology Stack

### IDE Client
- **Base**: VS Code OSS (TypeScript, Electron)
- **UI Framework**: React (for custom panels)
- **State Management**: VS Code's built-in state management + custom services
- **Build Tool**: VS Code's build system (gulp, webpack)
- **Package Manager**: npm/yarn

### Cloud Services (Already Built)
- **API**: Fastify (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Storage**: DigitalOcean Spaces (S3-compatible)
- **Auth**: Supabase Auth
- **Real-time**: WebSocket/SSE

### External Services
- **Tavus**: AI Avatar conversations
- **GitHub**: Repository access via GitHub App
- **LLM**: OpenAI, Anthropic, Google Gemini

## File Structure

```
persevere-ide/
├── ide/                           # VS Code OSS fork
│   ├── src/
│   │   ├── vs/                   # VS Code core (minimal modifications)
│   │   │   ├── workbench/
│   │   │   │   ├── browser/
│   │   │   │   │   └── parts/
│   │   │   │   │       ├── activitybar/
│   │   │   │   │       └── sidebar/
│   │   │   │   └── workbench.desktop.main.ts
│   │   │   └── platform/
│   │   │       └── storage/
│   │   └── persevere/            # Custom Persevere features
│   │       ├── meeting/
│   │       │   ├── meetingWidget.ts
│   │       │   ├── meetingPanel.ts
│   │       │   ├── meetingService.ts
│   │       │   └── meetingView.tsx
│   │       ├── chat/
│   │       │   ├── chatPanel.ts
│   │       │   ├── chatService.ts
│   │       │   └── chatView.tsx
│   │       ├── execution/
│   │       │   ├── executionPanel.ts
│   │       │   ├── executionService.ts
│   │       │   ├── executionView.tsx
│   │       │   └── timelineRenderer.tsx
│   │       ├── sync/
│   │       │   ├── syncService.ts
│   │       │   ├── localCache.ts
│   │       │   └── actionQueue.ts
│   │       ├── api/
│   │       │   ├── apiClient.ts
│   │       │   ├── authService.ts
│   │       │   └── websocketClient.ts
│   │       └── project/
│   │           ├── detector.ts
│   │           └── projectService.ts
│   ├── product.json              # Product branding
│   ├── package.json
│   └── build/                    # Build configuration
├── api/                           # Backend API (existing)
├── web/                           # Web dashboard (existing)
├── cloud-runner/                  # Cloud agent (existing)
└── supabase/                      # Database migrations (existing)
```

## Build & Distribution

### Development Build

```bash
cd ide
npm install
npm run watch
```

### Production Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Distribution

- **Windows**: `.exe` installer (NSIS or Inno Setup)
- **macOS**: `.dmg` or `.pkg` installer
- **Linux**: `.AppImage`, `.deb`, or `.rpm`

### Auto-Updates

- Use Electron's `autoUpdater` module
- Update server: Serve latest versions
- Check on startup and periodically
- Background download and install

## Security Considerations

1. **Token Storage**: Use OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service)
2. **CSP**: Strict Content Security Policy for webviews
3. **Code Signing**: Sign binaries for all platforms
4. **HTTPS Only**: All API communication over HTTPS
5. **Input Validation**: Validate all user inputs
6. **Sandboxing**: Electron renderer process sandboxing

## Performance Considerations

1. **Lazy Loading**: Load panels only when opened
2. **Virtual Scrolling**: For large timelines and logs
3. **Debouncing**: For real-time updates
4. **Caching**: Cache API responses locally
5. **Web Workers**: For heavy computations
6. **Code Splitting**: Split custom code from VS Code core

## Testing Strategy

1. **Unit Tests**: Jest for services and utilities
2. **Integration Tests**: Test API integration
3. **E2E Tests**: Playwright for UI flows
4. **Manual Testing**: Test on all platforms
5. **Performance Testing**: Measure startup time, memory usage

## MVP Scope

### Phase 1: Foundation (Weeks 1-2)
- [ ] VS Code OSS fork setup
- [ ] Custom branding
- [ ] Basic API client integration
- [ ] Authentication flow

### Phase 2: Core Features (Weeks 3-4)
- [ ] Tavus meeting integration (draggable widget)
- [ ] Chat panel
- [ ] Execution summary panel
- [ ] Basic offline sync

### Phase 3: Agent Integration (Weeks 5-6)
- [ ] Real-time job updates (WebSocket)
- [ ] Project detection
- [ ] Tech stack recommendations
- [ ] Job creation from meetings

### Phase 4: Polish (Weeks 7-8)
- [ ] UI/UX improvements
- [ ] Error handling
- [ ] Performance optimization
- [ ] Cross-platform builds

## Success Metrics

1. **Functionality**: All MVP features working
2. **Performance**: IDE startup < 3 seconds
3. **Reliability**: 99%+ uptime for cloud services
4. **User Experience**: Intuitive UI, smooth interactions
5. **Offline Support**: Seamless offline/online transitions

## Future Enhancements

1. **Local Agent Option**: Run agent locally for sensitive projects
2. **Multi-Project Support**: Manage multiple projects simultaneously
3. **Team Collaboration**: Share projects and collaborate
4. **Custom AI Models**: Allow users to bring their own LLM
5. **Plugin System**: Extend IDE with custom plugins
6. **Mobile Companion**: Mobile app for monitoring jobs


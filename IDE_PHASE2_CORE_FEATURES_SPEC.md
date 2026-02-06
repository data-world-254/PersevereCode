## Persevere IDE - Phase 02 Core Features Specification

### 1. Phase Overview

**Goal**: Implement the core AI collaboration features inside the Persevere IDE client, building on the Phase 01 branding and welcome experience. Phase 02 focuses on:

- **Tavus Meeting Integration** (draggable avatar widget + meeting panel)
- **Chat Panel** (conversational interface to the cloud agent)
- **Execution Summary Panel** (timeline view of jobs and artifacts)
- **Foundational Offline Sync** (queueing + basic conflict handling)

Phase 02 delivers a vertical slice: a user can open Persevere IDE, authenticate, start a Tavus meeting, see a job created from that meeting, and review it in the execution summary while chatting with the agent about it.

---

### 2. High-Level UX Flows

#### 2.1 Tavus Meeting Flow (Within IDE)

1. User opens Persevere IDE (already branded from Phase 01).
2. User opens the **Tavus Meeting Panel** from the activity bar.
3. User clicks **“Start Meeting”** for a selected project (or “New Project”).
4. A **draggable Tavus avatar widget** appears over the editor area:
   - Shows connection state (connecting / live / ended).
   - Shows minimal controls (mute, end meeting, collapse).
5. Meeting runs inside a webview (Tavus iframe) within the panel.
6. Transcript is streamed to the IDE (or fetched after completion).
7. When meeting ends:
   - Meeting summary appears in the panel.
   - A **“Create Job from Meeting”** action is available.
8. On confirmation, the IDE invokes the API to create a job and:
   - Shows the job in the **Execution Summary Panel**.
   - Notifies the user and links to the created job.

#### 2.2 Chat Panel Flow

1. User opens the **Chat Panel** from the activity bar.
2. User selects a project context (or “global” workspace context).
3. User sends a message (e.g. “Refactor the auth module”).
4. IDE sends the message to the cloud chat API with:
   - Current file path and selection (if any).
   - Project identifier.
   - Recent IDE actions (optional).
5. Chat panel displays:
   - Streaming responses from the agent.
   - Code blocks with formatting and copy buttons.
   - Quick actions (e.g., “Apply diff to workspace” in Phase 3; Phase 2 only displays them).

#### 2.3 Execution Summary Flow

1. User opens the **Execution Summary Panel** from the activity bar.
2. Panel shows a **job list** (left) and a **job timeline** (right).
3. When a new job is created (from Tavus meeting or other source):
   - It appears at the top of the list with a “LIVE” / “RUNNING” badge.
   - The timeline updates as events stream in (Phase 2: polling or basic WebSocket).
4. User can:
   - Filter by project.
   - Click a job to see steps, logs, and artifacts.
   - Open related resources (e.g., GitHub PR link) in browser.

#### 2.4 Offline Behavior (Phase 2 Scope)

1. If the IDE is offline when the user:
   - Starts a meeting, sends a chat, or triggers job-related actions:
2. The **Offline Sync Layer**:
   - Queues the action locally.
   - Shows an **“Offline”** indicator in the status bar.
   - Shows a local “pending” badge in each impacted panel.
3. When connectivity is restored:
   - The queue is flushed to the API in order.
   - Panels refresh their data from the server.

---

### 3. UI Components & Locations

> All paths are relative to `ide/src/vs/workbench` for VS Code core, and `ide/src/persevere` for custom Persevere code.

#### 3.1 Activity Bar & Views

- **New Activity Bar Icons**:
  - `Persevere Chat` icon
  - `Tavus Meeting` icon
  - `Execution Summary` icon
- **Integration Points**:
  - `browser/parts/activitybar/activitybarPart.ts`
  - `browser/parts/sidebar/sidebarPart.ts`
  - New Persevere contribution registry under `src/persevere/` for:
    - View containers
    - View descriptors

#### 3.2 Tavus Meeting Module

- **Location**: `ide/src/persevere/meeting/`
- **Core Files**:
  - `meetingWidget.ts` – Draggable avatar widget overlay.
  - `meetingPanel.ts` – Sidebar panel / view container.
  - `meetingService.ts` – Service for Tavus and backend API integration.
  - `meetingView.tsx` – React-based UI for meeting details and controls.
  - `meetingTypes.ts` – Shared types (meeting id, transcript, etc.).

#### 3.3 Chat Module

- **Location**: `ide/src/persevere/chat/`
- **Core Files**:
  - `chatPanel.ts` – Registers chat as a sidebar view / panel.
  - `chatService.ts` – Manages WebSocket / HTTP chat API.
  - `chatView.tsx` – React UI for message list + composer.
  - `messageRenderer.tsx` – Renders markdown, code blocks, and system messages.

#### 3.4 Execution Summary Module

- **Location**: `ide/src/persevere/execution/`
- **Core Files**:
  - `executionPanel.ts` – View container for execution summary.
  - `executionService.ts` – Fetches jobs and events from API.
  - `executionView.tsx` – Layout for job list + timeline.
  - `timelineRenderer.tsx` – Renders step-by-step execution.
  - `artifactViewer.tsx` – Displays logs, reports, and links.

#### 3.5 Offline Sync Layer

- **Location**: `ide/src/persevere/sync/`
- **Core Files**:
  - `syncService.ts` – Orchestrates online/offline state and queue.
  - `localCache.ts` – IndexedDB or VS Code storage-based cache.
  - `actionQueue.ts` – Queue abstraction with retry logic.
  - `syncStatusItem.ts` – Status bar integration for sync state.

---

### 4. Detailed Feature Specifications

#### 4.1 Tavus Meeting Integration

**Functional Requirements**:

- Start a Tavus meeting from Persevere IDE with:
  - Selected project id.
  - Optional title / description.
- Show a draggable avatar widget:
  - Draggable within editor area only (not outside workbench window).
  - Persist last position per workspace (`workspaceStorage`).
  - States: `connecting`, `live`, `muted`, `ended`, `error`.
- Display meeting panel with:
  - Meeting metadata (project, title, timestamps).
  - Embedded Tavus iframe.
  - Transcript preview (if available).
- When meeting finishes:
  - Fetch transcript (polling or webhook-triggered fetch).
  - Show a structured summary (title, bullet points, action items).
  - Provide a **“Create Job from Meeting”** button.

**Non-Functional Requirements**:

- Avoid freezing the editor during iframe load (use async webview init).
- All Tavus URLs configured through product-level configuration.
- Respect CSP for webviews (explicitly allow Tavus domains only).

**Key APIs & Services**:

- Internal Persevere backend:
  - `POST /projects/:id/meetings`
  - `GET /meetings/:id`
  - `GET /meetings/:id/transcript`
  - `POST /meetings/:id/jobs` (create a job from meeting)
- Tavus:
  - Handled through the backend; the IDE only talks to the backend.

**Storage**:

- Last widget position: `workspaceStorage` (e.g., `persevere.meeting.widgetPosition`).
- Last active meeting per project: `workspaceStorage` key.

#### 4.2 Chat Panel

**Functional Requirements**:

- Display conversation thread with:
  - User messages.
  - Agent messages.
  - System / status messages (e.g. offline, error).
- Support markdown rendering:
  - Headings, lists, code blocks.
  - Inline code, links (open in external browser).
- Show context chips:
  - Current project.
  - Current file (if any).
  - Selection line range (if any).
- Input composer:
  - Multi-line text box with `Enter` to send, `Shift+Enter` for newline.
  - Button to clear conversation.

**Backend Interaction**:

- WebSocket preferred when available, HTTP fallback:
  - `POST /chat/sessions/:id/messages`
  - `GET /chat/sessions/:id/messages` (initial history)
  - `GET /chat/sessions` (list sessions by project)
  - `WS /chat/stream` (streaming updates)

**Context Injection (Phase 2 subset)**:

- Include in each message payload:
  - `projectId`
  - `workspacePath` (relative)
  - `filePath` (if active editor)
  - `selection` (start/end line, optional)

**Offline Semantics**:

- When offline:
  - Messages are queued with timestamp.
  - UI marks them as “Pending”.
  - Once online, messages are sent in order; UI updates to “Sent”.

#### 4.3 Execution Summary Panel

**Functional Requirements**:

- Job list view:
  - List of jobs ordered by `createdAt` desc.
  - Columns: status, title, project, created time.
  - Filter by project.
- Job detail / timeline:
  - Steps with status (Pending, Running, Succeeded, Failed).
  - For each step: name, duration, short description.
  - Links to logs and artifacts.
- Integrations:
  - Deep links to external resources (GitHub PR, dashboards).

**Backend Interaction**:

- `GET /projects/:id/jobs`
- `GET /jobs/:id`
- `GET /jobs/:id/events`
- Optional: WebSocket topic for live updates (may be partially implemented in Phase 2).

**UI Behavior**:

- When a new job is created (from Tavus or otherwise):
  - Show toast/notification.
  - Auto-select the job in the list if execution panel is visible.

#### 4.4 Offline Sync Layer (Phase 2 Scope)

**Functional Requirements**:

- Detect online/offline:
  - Use browser `navigator.onLine` PLUS backend health check.
  - Debounce state changes to avoid flicker.
- Queueable actions (Phase 2):
  - Send chat message.
  - Create meeting.
  - Create job from meeting.
- Action Queue:
  - FIFO per action type.
  - Retry with exponential backoff.
  - Persist queue between IDE restarts (IndexedDB or file-based).

**Status Indicators**:

- Status bar item:
  - `Online`, `Offline`, `Syncing…`.
- Panel-local badges:
  - Pending actions count visible in Chat and Meeting panels.

---

### 5. Architecture & Implementation Plan

#### 5.1 New Namespaces / Modules

- `src/persevere/meeting/*`
- `src/persevere/chat/*`
- `src/persevere/execution/*`
- `src/persevere/sync/*`
- `src/persevere/api/*` (shared API client + auth integration, aligning with main spec)

Each module:

- Exposes a **service interface** (e.g., `IMeetingService`) registered via VS Code’s dependency injection system.
- Provides 1+ **views** (panels) implemented as webviews or workbench views.
- Uses shared **API client** for HTTP/WS calls.

#### 5.2 VS Code Integration Points

- **Contributions**:
  - New view containers and views registered in:
    - `workbench.desktop.main.ts` or a dedicated Persevere contribution file.
- **Commands**:
  - `persevere.meeting.start`
  - `persevere.chat.open`
  - `persevere.execution.open`
  - `persevere.sync.showStatus`
- **Context Keys**:
  - `persevere:isOnline`
  - `persevere:hasActiveMeeting`
  - `persevere:hasPendingActions`

#### 5.3 Data & State Management

- Use VS Code’s:
  - `Memento` (globalState/workspaceState) for lightweight preferences.
  - `IStorageService` for structured persisted state.
- Use custom `SyncService` for:
  - In-memory store of online/offline state.
  - Dispatching actions to queues.
  - Notifying panels via events.

---

### 6. Telemetry & Logging

- Log key events (without sensitive data):
  - Meeting started/ended.
  - Job created from meeting.
  - Chat message sent/received.
  - Offline queue length and retries.
- Provide hooks to connect to backend telemetry later.

---

### 7. Phase 02 Milestones

**Week 3 – Infrastructure & Skeletons**

- [ ] Create `src/persevere/*` folder structure.
- [ ] Implement shared API client + auth hookup.
- [ ] Register new view containers and icons in the activity bar.
- [ ] Implement `SyncService` skeleton with online/offline detection.

**Week 4 – Tavus & Chat**

- [ ] Implement Tavus Meeting panel + draggable widget (UI only first).
- [ ] Wire meeting creation to backend APIs.
- [ ] Parse and display basic transcript/summary.
- [ ] Implement Chat panel UI with local-only echo.
- [ ] Integrate Chat panel with backend chat API (HTTP + WS).
- [ ] Add basic offline queueing for chat and meeting actions.

**Week 5 – Execution Summary & Integration**

- [ ] Implement Execution Summary panel (job list + basic details).
- [ ] Wire job creation from meeting flow.
- [ ] Implement polling or WS-based job updates.
- [ ] Integrate Execution Summary with offline cache (read-mostly).
- [ ] Connect notifications between panels (meeting → job → execution view).

**Week 6 – Polish & Hardening**

- [ ] Improve error states and fallbacks (e.g., Tavus iframe errors).
- [ ] Finalize offline messaging and status indicators.
- [ ] Performance pass on webviews and data fetching.
- [ ] Add unit tests for services (meeting/chat/execution/sync).
- [ ] Manual QA passes on macOS, Windows, and Linux.

---

### 8. Success Criteria for Phase 02

1. User can start and finish a Tavus meeting from inside Persevere IDE.
2. User can create a job from a finished meeting and see it in Execution Summary.
3. User can carry out a multi-turn chat with the agent, with project/file context.
4. When offline, chat and meeting actions queue and later succeed when back online.
5. No blocking UI regressions to the core VS Code editor experience.


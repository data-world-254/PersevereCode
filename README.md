# Persevere

Cloud-first IDE + web dashboard + API for autonomous software development.

## Overview

Persevere is an autonomous software development platform that allows you to:

1. **Meet** with an AI avatar (Tavus CVI) to capture requirements
2. **Agree** on project goals, acceptance criteria, tech stack, and time budget
3. **Autopilot** - The cloud agent builds your project autonomously
4. **Review** changes via GitHub Pull Requests with execution timeline and artifacts

## Architecture

- **Persevere IDE** (`ide/`): VS Code OSS-based IDE with custom features
  - Tavus meeting integration (draggable avatar widget)
  - Chat panel for real-time agent communication
  - Execution summary panel for job timeline
  - Offline sync layer for seamless offline/online transitions
- **Web Dashboard** (`apps/web`): Next.js app for account management, billing, job history
- **Backend API** (`apps/api`): Fastify API with job orchestration, Tavus/GitHub/LLM integrations
- **Cloud Runner**: Autonomous agent that clones repos, implements features, tests, and creates PRs
- **Database**: Supabase (PostgreSQL) for jobs, users, artifacts
- **Storage**: DigitalOcean Spaces or AWS S3 for logs, test reports, build outputs

## Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account and project
- GitHub App (for repository access)
- Tavus account (for AI avatar meetings)
- LLM API keys (OpenAI, Anthropic, or Google Gemini)
- DigitalOcean Spaces or AWS S3 (for artifact storage)

## Setup

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Run the migration:

```bash
# In Supabase SQL Editor, run:
cat supabase/migrations/001_initial_schema.sql
```

Or use Supabase CLI:

```bash
supabase db push
```

### 2. Environment Configuration

#### Backend API (`apps/api/.env`)

Copy the example and fill in your values:

```bash
# Server
PORT=8080
API_BASE_URL=http://localhost:8080

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Auth
PERSEVERE_JWT_SECRET=your-32-char-secret-key-minimum

# Web App
WEB_APP_BASE_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# GitHub App (create at https://github.com/settings/apps/new)
GITHUB_APP_ID=your-github-app-id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret

# Tavus (get from https://tavus.io)
TAVUS_API_KEY=your-tavus-api-key
TAVUS_PERSONA_ID=your-tavus-persona-id
TAVUS_REPLICA_ID=your-tavus-replica-id (optional)

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
GEMINI_API_KEY=your-gemini-api-key

# Default LLM
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-4-turbo-preview

# Storage (DigitalOcean Spaces recommended)
STORAGE_PROVIDER=spaces
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_REGION=nyc3
SPACES_ACCESS_KEY_ID=your-spaces-access-key
SPACES_SECRET_ACCESS_KEY=your-spaces-secret-key
STORAGE_BUCKET=persevere-artifacts
STORAGE_BASE_URL=https://your-bucket.nyc3.digitaloceanspaces.com
```

#### Web App (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. GitHub App Setup

1. Go to https://github.com/settings/apps/new
2. Configure:
   - **Name**: Persevere
   - **Homepage URL**: Your app URL
   - **Callback URL**: `https://your-api-url.com/api/github/callback`
   - **Webhook URL**: `https://your-api-url.com/webhooks/github`
   - **Webhook secret**: Generate a random string
   - **Permissions**:
     - Contents: Read & Write
     - Pull Requests: Read & Write
     - Metadata: Read-only
   - **Where can this GitHub App be installed?**: Any account
3. After creating, note the **App ID**
4. Generate a **Private Key** (download .pem file)
5. Update `.env` with these values

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Locally

Terminal 1 - API:
```bash
npm run dev:api
```

Terminal 2 - Web:
```bash
npm run dev:web
```

Terminal 3 - Extension (optional, for development):
```bash
cd apps/extension
npm run build
# Then in VS Code: F5 to launch extension host
```

## Usage

### Web Dashboard

1. Visit http://localhost:3000
2. Sign in with Supabase Auth (email or GitHub)
3. Connect GitHub App installation
4. Create a project by selecting a repository
5. Start a meeting with the AI avatar
6. Review and approve the generated spec
7. Watch the cloud agent build your project

### VS Code Extension

1. Install the extension
2. Click "Sign in" in the status bar
3. Enter the code from the browser
4. Use commands:
   - `Persevere: Open chat` - Chat with the agent
   - `Persevere: Open meeting` - Start video meeting
   - `Persevere: Open execution summary` - View job timeline

## Project Structure

```
.
├── apps/
│   ├── api/                 # Backend API (Fastify)
│   │   ├── src/
│   │   │   ├── lib/         # Core libraries (auth, LLM, GitHub, Tavus, storage)
│   │   │   ├── routes/      # API routes (jobs, projects, webhooks)
│   │   │   └── services/    # Cloud runner service
│   │   └── package.json
│   ├── extension/           # VS Code extension
│   │   ├── src/
│   │   │   ├── extension.ts # Main entry point
│   │   │   ├── chatView.ts  # Chat panel
│   │   │   ├── meetingView.ts # Meeting panel
│   │   │   └── runsView.ts  # Execution summary
│   │   └── package.json
│   └── web/                 # Next.js dashboard
│       ├── app/             # Next.js app router
│       ├── lib/             # Supabase client, API helpers
│       └── package.json
├── supabase/
│   └── migrations/          # Database migrations
└── package.json             # Monorepo root
```

## Development Roadmap

### Phase 1: Foundation ✅
- [x] Database schema
- [x] Auth (Supabase + device login)
- [x] GitHub App integration
- [x] Tavus CVI integration
- [x] LLM providers (OpenAI, Anthropic, Gemini)
- [x] Basic job orchestration API

### Phase 2: Autonomous Agent Loop 🚧
- [x] Cloud runner structure
- [ ] Full agent loop with code generation
- [ ] Test execution and reporting
- [ ] Build validation
- [ ] Event streaming (WebSocket/SSE)

### Phase 1: Foundation Setup 🚧 (70% Complete)
- [x] VS Code OSS cloned from https://github.com/microsoft/vscode.git
- [x] Product branding updated (product.json)
- [x] Package metadata updated (package.json)
- [x] Custom directory structure created (src/persevere/)
- [x] Documentation created (technical spec, migration plan, setup guide)
- [ ] Install dependencies (⚠️ BLOCKED: Requires Node.js 22.x, current: 20.19.6)
- [ ] Test build process (pending dependencies)
- [ ] Verify IDE launch (pending build)

**Note**: See `PHASE1_COMPLETE.md` and `PHASE1_NODEJS_REQUIREMENT.md` for details.

### Phase 2: Cloud Services Integration 📋 (Pending Phase 1)
- [ ] Integrate API client
- [ ] Authentication service
- [ ] WebSocket client for real-time updates
- [ ] Basic offline sync layer

### Phase 3: Custom UI Components 📋 (Pending Phase 2)
- [ ] Draggable Tavus avatar widget
- [ ] Chat panel
- [ ] Execution summary panel
- [ ] Activity bar integration

### Phase 4: Polish & Distribution 📋 (Future)
- [ ] UI/UX improvements
- [ ] Error handling
- [ ] Performance optimization
- [ ] Cross-platform builds (Windows, macOS, Linux)

### Phase 4: Polish & Scale 📋
- [ ] Error handling and retries
- [ ] Cost controls
- [ ] Rate limiting
- [ ] Monitoring and logging
- [ ] Subscription management
- [ ] Web dashboard UI

## License

Private - All rights reserved


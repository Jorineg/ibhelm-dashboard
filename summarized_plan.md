I'll create a comprehensive project plan for your file management system with Vue + Vite.

<invoke name="canvas">
<parameter name="type">document</parameter>
<parameter name="title">ibhelm File Management System - Vue + Vite Implementation Plan</parameter>
<parameter name="content"># ibhelm File Management System
## Vue + Vite Architecture Plan

---

## 1. Project Overview

**Client:** ibhelm - Ingenieurbüro für technische Gebäudeausrüstung, Berlin

**Goal:** Unified file and project management system with:
- Centralized document storage
- Smart metadata management
- Granular external sharing
- Multi-source data integration (Teamwork, Missive)

**Key Benefits:**
- Single source of truth for all project data
- Efficient search across projects
- Secure client access with fine-grained control
- Automated email attachment handling

---

## 2. Tech Stack

### Frontend
```
Vue 3 (Composition API)
├── Vite (Build tool & dev server)
├── Vue Router (Client-side routing)
├── TypeScript (Type safety)
└── UI Components
    ├── PrimeVue (Complete UI library)
    └── TanStack Table Vue (Data tables)
```

### Backend & Database
```
Supabase (Self-hosted)
├── PostgreSQL (Database + RLS)
├── S3-compatible Storage
├── Authentication (incl. Google OAuth)
└── Auto-generated REST API
```

### File Storage
```
Primary: Synology NAS (DS923+)
├── Local file storage
├── Synology Drive (PC sync)
└── Docker Container Manager

Backup: Supabase S3 Storage
└── Unidirectional sync via rclone (every 15 min)
```

### Worker Services (Docker on NAS)
```
1. Missive Attachment Downloader
2. Thumbnail Generator & Text Extractor
3. File Metadata Scanner
4. Teamwork/Missive DB Connector
```

### Monitoring
```
Better Stack (Logtail)
├── Centralized logging
├── Service health monitoring
└── Alert system
```

### Deployment
```
Vercel (Free Tier)
└── Static site hosting
```

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  User Layer                         │
│                                                     │
│  Internal Users          External Users             │
│  (Admins/Team)          (Clients/Partners)          │
└────────────┬────────────────────────┬───────────────┘
             │                        │
             ▼                        ▼
┌─────────────────────────────────────────────────────┐
│              Vue + Vite Web App                     │
│              (Hosted on Vercel)                     │
│                                                     │
│  Unified UI with Permission-based Features          │
│  ├── File Browser                                   │
│  ├── Metadata Editor                                │
│  ├── Access Control Panel (Admin only)             │
│  └── External Share View                            │
└────────────┬────────────────────────────────────────┘
             │
             │ Direct Connection (REST + Auth Token)
             │
             ▼
┌─────────────────────────────────────────────────────┐
│         Supabase (Self-hosted on Server)            │
│                                                     │
│  ├── PostgreSQL with RLS                           │
│  │   └── Row Level Security Policies               │
│  ├── Authentication (Google OAuth + Email)         │
│  ├── REST API (auto-generated)                     │
│  └── S3-compatible Storage                          │
└────────────┬────────────────────────────────────────┘
             │
             │ Backup Sync
             │
             ▼
┌─────────────────────────────────────────────────────┐
│          Synology NAS (DS923+)                      │
│                                                     │
│  Primary File Storage:                              │
│  ├── /volume1/files/                               │
│  │   ├── projects/                                 │
│  │   ├── emails/                                   │
│  │   └── missive_attachments/                      │
│  │                                                 │
│  Docker Services:                                   │
│  ├── Missive Attachment Downloader                 │
│  ├── Thumbnail Generator                            │
│  ├── Text Extractor                                │
│  └── File Metadata Scanner                          │
│                                                     │
│  rclone (Cron Job every 15 min)                    │
│  └── Sync to Supabase S3 →                         │
└─────────────────────────────────────────────────────┘
```

---

## 4. Database Schema (PostgreSQL)

### Core Tables (public schema)

**profiles**
```sql
- id (UUID, references auth.users)
- email
- full_name
- role ('admin' | 'user')
- created_at
```

**projects**
```sql
- id (UUID)
- name
- customer_id (FK)
- status
- created_at
```

**customers**
```sql
- id (UUID)
- name
- contact_info
```

**file_metadata**
```sql
- id (UUID)
- storage_object_id (FK to storage.objects)
- filename
- storage_path
- project_id (FK)
- customer_id (FK)
- building
- room
- gewerk (trade/discipline)
- tags (TEXT[])
- extracted_text
- thumbnail_path
- created_at
- updated_at
```

**access_grants** (for external sharing)
```sql
- id (UUID)
- token (unique, auto-generated)
- base_project_id (FK)
- label (description)
- created_by (FK to profiles)
- expires_at
- created_at
```

**access_overrides** (include/exclude rules)
```sql
- id (UUID)
- grant_id (FK)
- resource_type ('file' | 'task' | 'email')
- resource_id (UUID)
- action ('include' | 'exclude')
```

**tasks** (from Teamwork)
```sql
- id (UUID)
- external_id (Teamwork ID)
- title
- description
- project_id (FK)
- assignee_id
- status
- due_date
- synced_at
```

**emails** (from Missive)
```sql
- id (UUID)
- external_id (Missive ID)
- subject
- from_email
- to_email
- received_at
- conversation_id
- has_attachments
- synced_at
```

### Supabase Managed Tables

**auth.users** (managed by Supabase)
- User authentication data
- Only accessible via Supabase Studio or Admin API

**storage.objects** (managed by Supabase)
- Physical file storage metadata
- Joined with file_metadata via storage_path

---

## 5. Security Architecture (Tier 2)

### Authentication
```
All users must authenticate
├── Internal: Google OAuth or Email
└── External: Email magic link or password
```

### Authorization via RLS Policies

**Internal Users (Admins):**
```sql
-- See all files
CREATE POLICY "admins_see_all_files"
ON file_metadata FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Manage all grants
CREATE POLICY "admins_manage_grants"
ON access_grants FOR ALL
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
```

**External Users:**
```sql
-- See files from granted projects
CREATE POLICY "external_user_access"
ON file_metadata FOR SELECT
USING (
  -- Files from projects they have access to
  project_id IN (
    SELECT base_project_id FROM access_grants
    WHERE EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
    )
  )
  -- Minus explicit excludes
  AND id NOT IN (
    SELECT resource_id FROM access_overrides
    WHERE grant_id IN (
      SELECT id FROM access_grants
      WHERE token = current_setting('request.jwt.claims')::json->>'access_token'
    )
    AND action = 'exclude'
  )
  -- Plus explicit includes
  OR id IN (
    SELECT resource_id FROM access_overrides
    WHERE action = 'include'
  )
);
```

### File Downloads

**Method: Signed URLs (1-4 hour expiry)**
```javascript
// Vue component
async function getDownloadUrl(file) {
  // User must be authenticated
  const { data, error } = await supabase.storage
    .from('files')
    .createSignedUrl(file.storage_path, 14400) // 4 hours
  
  return data.signedUrl
}
```

**Why Signed URLs:**
- ✅ Protects against URL guessing
- ✅ Time-limited access
- ✅ Can be revoked (by not generating new ones)
- ✅ Appropriate for technical documents (not highly sensitive)

### Audit Logging
```javascript
// Track all file access
await supabase.from('audit_log').insert({
  user_id: user.id,
  action: 'download',
  resource_type: 'file',
  resource_id: file.id,
  timestamp: new Date()
})
```

---

## 6. Vue Application Structure

```
my-file-manager/
├── src/
│   ├── views/
│   │   ├── HomeView.vue
│   │   ├── LoginView.vue
│   │   ├── FilesView.vue
│   │   ├── ProjectsView.vue
│   │   ├── AdminView.vue
│   │   │   ├── GrantsManagement.vue
│   │   │   └── UserManagement.vue
│   │   └── ShareView.vue (/:token)
│   │
│   ├── components/
│   │   ├── FileExplorer.vue
│   │   ├── FileTable.vue
│   │   ├── FileUploader.vue
│   │   ├── MetadataEditor.vue
│   │   ├── AccessGrantDialog.vue
│   │   ├── FilterBar.vue
│   │   └── AdminToolbar.vue
│   │
│   ├── composables/
│   │   ├── useSupabase.js
│   │   ├── useAuth.js
│   │   ├── usePermissions.js
│   │   └── useFiles.js
│   │
│   ├── router/
│   │   └── index.js
│   │
│   ├── lib/
│   │   └── supabase.js
│   │
│   └── App.vue
│
├── index.html
├── vite.config.js
├── package.json
└── .env
```

### Key Vue Patterns

**Permission-based UI (Composable):**
```javascript
// composables/usePermissions.js
export function usePermissions() {
  const user = useSupabaseUser()
  
  const isAdmin = computed(() => 
    user.value?.app_metadata?.role === 'admin'
  )
  
  const canEditFiles = computed(() => isAdmin.value)
  const canCreateGrants = computed(() => isAdmin.value)
  const canBulkSelect = computed(() => isAdmin.value)
  
  return {
    isAdmin,
    canEditFiles,
    canCreateGrants,
    canBulkSelect
  }
}
```

**File Management (Composable):**
```javascript
// composables/useFiles.js
export function useFiles(projectId) {
  const supabase = useSupabaseClient()
  const files = ref([])
  const loading = ref(true)
  
  async function loadFiles() {
    loading.value = true
    const { data } = await supabase
      .from('file_metadata')
      .select('*, projects(*)')
      .eq('project_id', projectId)
    
    files.value = data
    loading.value = false
  }
  
  async function downloadFile(file) {
    const { data } = await supabase.storage
      .from('files')
      .createSignedUrl(file.storage_path, 14400)
    
    window.open(data.signedUrl, '_blank')
  }
  
  return { files, loading, loadFiles, downloadFile }
}
```

---

## 7. Worker Services

### 1. Missive Attachment Downloader

**Purpose:** Automatically download email attachments from Missive

**Deployment:** Docker on Synology NAS

**Flow:**
```
1. Poll Missive API (every 60s)
2. Detect new conversations with attachments
3. Download attachments
4. Save to /volume1/files/missive_attachments/
5. Write metadata to Postgres (emails, file_metadata)
6. Log to Better Stack
```

**Key Features:**
- Filename sanitization: `FROM_{sender}_TO_{recipient}_NAME_{filename}`
- Deduplication via content hash
- Retry logic with exponential backoff

### 2. Thumbnail Generator & Text Extractor

**Purpose:** Create previews and extract searchable text

**Deployment:** Docker on Synology NAS

**Trigger:** Postgres LISTEN/NOTIFY on file_metadata INSERT

**Flow:**
```
1. Receive notification: new file inserted
2. Download file from Supabase Storage
3. For images: Generate thumbnail (sharp)
4. For PDFs: 
   - Extract first page as thumbnail (ImageMagick)
   - Extract text (PyMuPDF/pdfplumber)
5. Upload thumbnail to storage/thumbnails/
6. Update file_metadata with:
   - thumbnail_path
   - extracted_text
7. Log to Better Stack
```

### 3. File Metadata Scanner

**Purpose:** Scan NAS filesystem and update database

**Deployment:** Docker on Synology NAS

**Schedule:** Daily + on-demand

**Flow:**
```
1. Scan /volume1/files/ recursively
2. For each file:
   - Calculate hash
   - Extract metadata from path/filename
   - Check if exists in DB (by hash or path)
   - Insert or update file_metadata
3. Flag orphaned DB entries
4. Log statistics to Better Stack
```

### 4. Teamwork/Missive DB Connector

**Purpose:** Sync tasks and email metadata

**Deployment:** Hetzner server or local machine

**Method:** Direct Postgres connection (not Supabase API)

**Flow:**
```
Teamwork Sync:
1. Fetch tasks from Teamwork API
2. Transform to DB format
3. Bulk UPSERT to tasks table
4. Update sync timestamp

Missive Sync:
1. Fetch conversations/messages
2. Write email metadata (no attachments - see service #1)
3. Link to projects via rules
4. Update sync timestamp
```

---

## 8. Development Workflow

### Initial Setup
```bash
# 1. Create Vue project
npm create vue@latest ibhelm-file-manager
cd ibhelm-file-manager

# 2. Install dependencies
npm install
npm install @supabase/supabase-js
npm install primevue primeicons
npm install @tanstack/vue-table
npm install @vueuse/core

# 3. Configure Supabase
# Create .env.local:
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your-anon-key

# 4. Run dev server
npm run dev
```

### Deployment to Vercel
```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-repo
git push -u origin main

# 2. Connect to Vercel
vercel login
vercel

# 3. Configure environment variables in Vercel dashboard
# → Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Done! Auto-deploys on every push
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Supabase self-hosting setup (Docker)
- [ ] Database schema creation
- [ ] RLS policies for core tables
- [ ] NocoDB connection for admin tasks

### Phase 2: File Infrastructure (Week 3-4)
- [ ] Missive Attachment Downloader (Docker)
- [ ] rclone sync setup (NAS → Supabase S3)
- [ ] File Metadata Scanner service
- [ ] Thumbnail Generator worker

### Phase 3: Vue Application (Week 5-6)
- [ ] Vue + Vite project setup
- [ ] Supabase authentication integration
- [ ] File Explorer component with PrimeVue DataTable
- [ ] Permission system (usePermissions composable)
- [ ] Basic CRUD operations

### Phase 4: Access Control (Week 7-8)
- [ ] Access Grants management UI
- [ ] Include/Exclude rules editor
- [ ] External share view (/:token route)
- [ ] Signed URL generation
- [ ] Audit logging

### Phase 5: Integration & Polish (Week 9-10)
- [ ] Teamwork/Missive DB Connector
- [ ] Better Stack logging for all services
- [ ] Advanced search with filters
- [ ] Metadata batch editing
- [ ] Testing and bug fixes

---

## 10. Monitoring & Maintenance

### Better Stack Integration

All services send structured logs:
```javascript
// Example log format
{
  level: 'info',
  service: 'thumbnail-generator',
  message: 'Thumbnail generated',
  file_id: 'abc-123',
  duration_ms: 1234,
  timestamp: '2024-01-15T10:30:00Z'
}
```

**Alerts configured for:**
- Service down (no logs for 5+ minutes)
- High error rate (>5 errors in 10 minutes)
- Slow processing (thumbnails >10s)

### Backup Strategy

**Database:**
- Daily pg_dump to NAS
- Keep 7 daily + 4 weekly backups
- Test restore monthly

**Files:**
- Primary: NAS (with Synology snapshot)
- Secondary: Supabase S3 (via rclone sync)
- Tertiary: External backup (optional)

### Updates

**Supabase:**
- Monitor release notes
- Test in staging first
- Database migrations via SQL scripts

**Vue App:**
- Dependabot for security updates
- Test locally before deploy
- Vercel preview deployments for testing

---

## 11. Cost Estimate

| Component | Provider | Cost |
|-----------|----------|------|
| **Vue App Hosting** | Vercel | €0 (Free tier) |
| **Supabase** | Self-hosted | €0 (software) |
| **Server** | Hetzner CX11 | ~€5/month |
| **NAS** | Synology DS923+ | One-time (~€600) |
| **Monitoring** | Better Stack | €0-18/month |
| **Domain** | Any registrar | €10/year |
| **Total** | | **~€6-24/month** |

---

## 12. Success Criteria

**Functionality:**
- ✅ All project files searchable by metadata
- ✅ External clients can access their projects securely
- ✅ Email attachments auto-downloaded and categorized
- ✅ All services monitored and healthy

**Performance:**
- ✅ File search <500ms
- ✅ File download (signed URL) <2s
- ✅ UI responsive (<100ms interactions)

**Security:**
- ✅ No unauthorized data access
- ✅ Audit trail for all file downloads
- ✅ Regular backups tested and working

**Usability:**
- ✅ Admins can create share links in <1 minute
- ✅ Clients can find and download files easily
- ✅ No training required for basic operations

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Set up development environment** (Supabase + NAS)
3. **Start with Phase 1** (Foundation)
4. **Iterate and adjust** based on learnings

**Questions to resolve:**
- Exact hardware specs for Supabase server
- User onboarding process details
- Specific metadata fields per document type
- Timeline constraints</parameter>
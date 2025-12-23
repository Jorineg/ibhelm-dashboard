# ibhelm Dashboard

A sophisticated Vue 3 + Vite frontend for managing tasks, emails, and project data with advanced filtering, search, and configuration management.

## Features

- ✅ **Unified Data View**: Display tasks, emails, information items, and files in a single, high-performance table.
- ✅ **Advanced Filtering**: 
  - Always-visible sidebar filters (Project, Customer, Building, Floor, Room, Kostengruppe).
  - Dynamic filters with complex operators (eq, neq, contains, date ranges, etc.).
  - Named filter configurations for quick access.
- ✅ **Smart Search**: Near-instant global search across all metadata.
- ✅ **Dynamic UI**: 
  - Column management (drag-and-drop, visibility toggles).
  - List and Gallery view modes with PDF/Image previews.
  - Auto-hide empty columns for cleaner interface.
- ✅ **Infinite Scrolling**: Smooth data loading without traditional pagination.
- ✅ **Secure Access**: Supabase Magic Link authentication with role-based access control.

## Tech Stack

- **Vue 3** (Composition API + Vite)
- **Tanstack Table** (High-performance data grid logic)
- **PrimeVue** (UI Component Library)
- **Supabase** (Auth & Real-time Database)
- **TypeScript** (Robust type safety)


## Prerequisites

- Node.js 18+ and npm
- Supabase instance (self-hosted or cloud)
- Email OTP / Magic Link enabled in Supabase

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace with your actual Supabase credentials.

### 3. Configure Supabase

#### Enable Magic Link (Email OTP)

1. Go to your Supabase dashboard
2. Navigate to Authentication > Providers
3. Enable **Email** provider
4. Ensure **Confirm Email** is enabled (optional but recommended)
5. Ensure **Secure OTP** or **Magic Link** is enabled
6. Configure your SMTP settings or use Supabase's default (limited)

#### Database Schema

Ensure your Supabase database has the following tables:
- `tasks` (Teamwork tasks)
- `tw_projects`, `tw_companies`, `tw_users`, `tw_tags`, `tw_tasklists` (related tables)
- `m_messages`, `m_conversations`, `m_contacts` (Missive email tables)

See `supabase_postgres_schema.md` for the full schema.

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
src/
├── components/          # Reusable Vue components
│   ├── ConfigurationPanel.vue   # Saved filter configurations
│   ├── DataTable.vue            # Main data table (list/gallery)
│   ├── FilterBar.vue            # Filter controls
│   └── ItemDetailDialog.vue     # Item detail popup
├── composables/         # Vue composables (reusable logic)
│   ├── useAuth.ts              # Authentication logic
│   ├── useData.ts              # Data fetching and filtering
│   └── useFilterConfigs.ts     # Filter configuration management
├── lib/                 # Libraries and utilities
│   └── supabase.ts             # Supabase client
├── router/              # Vue Router configuration
│   └── index.ts
├── types/               # TypeScript types
│   └── index.ts
├── views/               # Page components
│   ├── HomeView.vue            # Main dashboard view
│   └── LoginView.vue           # Login page
├── App.vue              # Root component
├── main.ts              # App entry point
└── style.css            # Global styles
```

## Usage

### Login

1. Navigate to the app
2. Enter your email address
3. Click "Send Magic Link"
4. Check your email for a code or login link
5. Enter the code in the app or click the link to authenticate

### Filtering

#### Always-Visible Filters

The following filters are always visible (configurable in code):
- Project
- Customer
- Building
- Floor
- Room
- Kostengruppe

Simply type in any of these fields to filter the data.

#### Dynamic Filters

1. Click "Add Filter" to add a new filter
2. Select a column, operator, and value
3. The filter is applied immediately and auto-saved

#### Filter Operators

- **Equals**: Exact match
- **Not Equals**: Does not match
- **Contains**: Text contains value
- **Does Not Contain**: Text does not contain value
- **Is Empty**: Field is empty
- **Is Not Empty**: Field has a value
- **Before**: Date is before value
- **After**: Date is after value

### Search

Use the search bar at the top to search across all columns. The search is applied in addition to filters.

### Filter Configurations

#### Create New Configuration

Click the "New" button in the Configuration Panel to create a new empty configuration.

#### Save Configuration

All changes are automatically saved to the active configuration.

#### Duplicate Configuration

1. Make sure the configuration you want to duplicate is active
2. Click "Duplicate"
3. The new configuration will be created with "(copy)" appended to the name

#### Delete Configuration

1. Select the configuration to delete
2. Click "Delete"
3. Confirm the deletion

**Note**: You cannot delete the last configuration.

### View Modes

Toggle between **List** and **Gallery** views using the buttons in the toolbar.

- **List View**: Traditional table with sortable columns
- **Gallery View**: Card-based view with thumbnails

### Show/Hide Columns

Use the column selector dropdown to choose which columns to display.

### Item Types

Toggle between the following data types using the checkboxes in the toolbar:
- **Tasks**: To-Dos and project milestones from Teamwork.
- **Emails**: Project communications from Missive.
- **Information Items**: Relevant project notes and documentation.
- **Files**: Physical documents and attachments stored on the NAS.

### View Item Details

Click any row (or gallery card) to open a popup with full item details.

## Customization

### Changing Default Always-Visible Filters

Edit `src/composables/useFilterConfigs.ts` and modify the `DEFAULT_ALWAYS_VISIBLE_FILTERS` array:

```typescript
const DEFAULT_ALWAYS_VISIBLE_FILTERS = [
  'project',
  'customer',
  'building',
  'floor',
  'room',
  'kostengruppe'
]
```

### Adding New Columns

Edit `src/views/HomeView.vue` and add to the `availableColumns` computed property:

```typescript
const availableColumns = computed<Column[]>(() => [
  // ... existing columns
  { field: 'my_new_field', header: 'My New Field', sortable: true, width: '150px' }
])
```

## Troubleshooting

### Authentication Not Working

- Verify your Supabase URL and anon key in `.env`
- Check that Email OTP/Magic Link is enabled in Supabase dashboard
- Ensure your email is not being blocked as spam

### Data Not Loading

- Check browser console for errors
- Verify database tables exist and have data
- Check Supabase RLS (Row Level Security) policies

### Filter Configurations Not Saving

- Check browser LocalStorage is enabled
- Clear browser cache and reload
- Check browser console for errors

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy!

Vercel will automatically build and deploy your app on every push.

### Other Platforms

Any static site hosting platform works:
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Your own server

Just run `npm run build` and upload the `dist/` folder.

## License

Proprietary - ibhelm Ingenieurbüro für technische Gebäudeausrüstung

## Support

For issues or questions, contact the development team.


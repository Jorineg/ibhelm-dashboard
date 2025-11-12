# 🚀 Quick Start Guide

Get up and running with the dbhelm Dashboard in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- Supabase account (cloud or self-hosted)
- Google account for OAuth

## Step-by-Step Setup

### 1️⃣ Install Dependencies (1 minute)

```bash
npm install
```

### 2️⃣ Configure Environment (2 minutes)

Create a `.env` file:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Where to find these:**
- Go to [Supabase Dashboard](https://app.supabase.com)
- Select your project
- Settings → API
- Copy "Project URL" and "anon public" key

### 3️⃣ Enable Google OAuth (2 minutes)

1. In Supabase Dashboard: **Authentication** → **Providers**
2. Enable **Google**
3. Add Google Client ID and Secret (see [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) for details)

### 4️⃣ Run the App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

## First Time Using the Dashboard

1. **Login**: Click "Sign in with Google"
2. **Explore**: The dashboard will load with a default filter configuration
3. **Filter**: Use the always-visible filters on the left (project, customer, etc.)
4. **Search**: Type in the search bar to find items across all columns
5. **Click Items**: Click any row to see full details
6. **Save Filters**: Your filter settings are automatically saved!

## Key Features to Try

### 🔍 Search
The search bar at the top searches across ALL columns in real-time.

### 🎯 Filters
- **Always visible**: Project, Customer, Building, Floor, Room, Kostengruppe
- **Add more**: Click "Add Filter" to add custom filters with operators

### 💾 Save Configurations
1. Set up your perfect filters
2. They're auto-saved!
3. Create new configs with the "New" button
4. Switch between saved configs in the left panel

### 👁️ Show/Hide Columns
Use the dropdown in the toolbar to select which columns to display.

### 📊 View Modes
Toggle between **List** (table) and **Gallery** (cards) view.

### ✅ Toggle Item Types
Show/hide tasks and emails independently with the checkboxes.

### ♾️ Infinite Scroll
Just scroll down - more data loads automatically!

## Common First-Time Issues

### "Missing Supabase environment variables"
- Check that `.env` exists in the project root
- Restart the dev server after creating `.env`

### "No data showing"
- Make sure your Supabase database has data in `tasks` or `m_messages` tables
- Check browser console for errors

### Google login not working
- Verify Google OAuth is enabled in Supabase
- Check redirect URL is correct: `http://localhost:5173`

## What's Next?

- Read [README.md](./README.md) for full feature documentation
- See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md) for detailed setup
- Explore the code in `src/` to customize

## Project Structure at a Glance

```
src/
├── views/
│   ├── HomeView.vue          ← Main dashboard
│   └── LoginView.vue          ← Login page
├── components/
│   ├── DataTable.vue          ← Table/gallery
│   ├── FilterBar.vue          ← Filters
│   ├── ConfigurationPanel.vue ← Saved configs
│   └── ItemDetailDialog.vue   ← Item popup
├── composables/
│   ├── useAuth.ts             ← Google login
│   ├── useData.ts             ← Fetch data
│   └── useFilterConfigs.ts    ← Save filters
└── lib/
    └── supabase.ts            ← Supabase client
```

## Need Help?

1. Check the [README.md](./README.md)
2. Look at [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)
3. Open the browser console for error messages
4. Contact the development team

---

**Happy filtering!** 🎉


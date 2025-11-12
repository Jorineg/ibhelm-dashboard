# Setup Instructions for dbhelm Dashboard

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Supabase Credentials

You need two pieces of information from your Supabase instance:

#### Option A: Supabase Cloud

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

#### Option B: Self-Hosted Supabase

1. Your Supabase URL will be your server address (e.g., `http://your-server:8000`)
2. Find your anon key in your Supabase configuration
3. Or generate one using the Supabase CLI

### 3. Create Environment File

Create a `.env` file in the project root with your credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Example:**
```env
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MjE1NzE2MDAsImV4cCI6MTkzNzE0NzYwMH0.xxxxxxxxxxxxxxxxxxxxx
```

### 4. Configure Google OAuth in Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list and enable it
4. You'll need to create a Google OAuth app:

#### Creating Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the consent screen if prompted
6. For Application type, select **Web application**
7. Add authorized redirect URIs:
   - For development: `http://localhost:5173`
   - For Supabase: `https://your-project-id.supabase.co/auth/v1/callback`
8. Copy the **Client ID** and **Client Secret**

#### Add Credentials to Supabase

1. Back in Supabase dashboard under **Authentication** → **Providers** → **Google**
2. Paste your **Client ID** and **Client Secret**
3. Enable the provider
4. Save

### 5. Verify Database Schema

Make sure your Supabase database has the required tables. The schema is defined in `supabase_postgres_schema.md`.

Key tables needed:
- `tasks` - Teamwork tasks
- `tw_projects` - Projects
- `tw_companies` - Companies/customers
- `tw_users` - Users
- `tw_tags` - Tags
- `tw_tasklists` - Task lists
- `m_messages` - Email messages
- `m_conversations` - Email conversations
- `m_contacts` - Email contacts

### 6. Run the Development Server

```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### 7. Test Login

1. Click "Sign in with Google"
2. You should be redirected to Google's OAuth consent screen
3. Authorize the app
4. You should be redirected back to the dashboard

## Troubleshooting

### "Missing Supabase environment variables" Error

- Make sure your `.env` file is in the project root (same folder as `package.json`)
- Make sure the variable names are exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart the dev server after creating/modifying the `.env` file

### Google OAuth Not Working

- Verify your redirect URI is correct in Google Cloud Console
- Make sure you added both development and production URLs
- Check that Google OAuth is enabled in Supabase dashboard
- Make sure your Client ID and Secret are correctly entered in Supabase

### "Relation does not exist" Database Errors

- Run the SQL migrations to create the required tables
- Check that your database schema matches `supabase_postgres_schema.md`
- Verify you're connected to the correct database

### No Data Showing

- Make sure your database has data in the `tasks` and `m_messages` tables
- Check the browser console for errors
- Verify Row Level Security (RLS) policies allow reading data

### CORS Errors

- If using self-hosted Supabase, make sure CORS is configured
- Check that your Supabase URL is accessible from your browser

## Production Deployment

### Environment Variables

When deploying to production (e.g., Vercel, Netlify), add these environment variables:

- `VITE_SUPABASE_URL` - Your production Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Your production Supabase anon key

### Google OAuth Redirect

Don't forget to add your production domain to:
1. Google Cloud Console authorized redirect URIs
2. Supabase OAuth settings (if applicable)

Example:
- `https://your-app.vercel.app`
- `https://your-project-id.supabase.co/auth/v1/callback`

## Next Steps

After successful setup:

1. Explore the dashboard features
2. Create filter configurations
3. Try searching and filtering data
4. Toggle between list and gallery views
5. Click on items to view details

## Need Help?

If you encounter issues not covered here:

1. Check the browser console for error messages
2. Check the Supabase logs in the dashboard
3. Review the README.md for usage instructions
4. Contact the development team

## Security Notes

- **Never commit your `.env` file to version control** - it's already in `.gitignore`
- Keep your Supabase credentials secure
- Use Row Level Security (RLS) policies in Supabase to protect your data
- The anon key is meant to be public-facing but should still be kept reasonably secure


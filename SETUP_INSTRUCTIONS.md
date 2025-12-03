# Setup Instructions for ibhelm Dashboard

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

### 4. Configure Email Magic Link Authentication in Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Email** in the list and make sure it's enabled
4. Configure the email settings:
   - **Enable email provider**: ON
   - **Confirm email**: Optional (can be OFF for easier setup)
   - **Secure email change**: Optional

#### Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize the "Magic Link" email template if desired
3. Make sure the magic link URL is correct

#### Important Notes

- Users must be created in the Supabase dashboard first (Authentication → Users → Add User)
- The app does not allow self-signup - only login for existing users
- Magic links are valid for a limited time (default: 1 hour)

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

### 7. Create a Test User

Before you can log in, you need to create a user in Supabase:

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add User**
4. Enter an email address and create a password
5. Click **Create User**

### 8. Test Login

1. Enter your email address on the login page
2. Click "Send Magic Link"
3. Check your email inbox for the magic link
4. Click the link in the email
5. You should be redirected to the dashboard

## Troubleshooting

### "Missing Supabase environment variables" Error

- Make sure your `.env` file is in the project root (same folder as `package.json`)
- Make sure the variable names are exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Restart the dev server after creating/modifying the `.env` file

### Magic Link Email Not Arriving

- Check your spam/junk folder
- Verify the Email provider is enabled in Supabase (Authentication → Providers → Email)
- Check Supabase logs for email sending errors
- If using SMTP, verify your SMTP settings in Supabase
- For development, check if you need to configure a custom SMTP (default uses Supabase's email service)

### "Unable to connect to authentication service" Error

- Verify your `.env` file has the correct Supabase URL and anon key
- Check that your Supabase project is running and accessible
- Test the connection by visiting your Supabase URL in a browser
- Restart the dev server after changing environment variables

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

### Site URL Configuration

Make sure to configure your site URL in Supabase:

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain (e.g., `https://your-app.vercel.app`)
3. Add any additional redirect URLs if needed

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


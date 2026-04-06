

# HireMind AI — Full Build Plan

## Brand & Design System
- **Colors**: Navy Blue (#0A1F44) primary, Blue accent (#2563EB), light/dark themes
- **Logo**: SVG component — human head silhouette with circuit lines, used in navbar, landing, and login
- **Tagline**: "Hire smarter, not harder"
- **Dark theme**: Background #0F172A, cards #1E293B, text white
- **Light theme**: Background white, text dark
- **Theme toggle** in navbar, saved to localStorage

## Pages & Routing

### Public Pages
- **Landing Page** (`/`): Hero with logo + tagline + CTA, Features section, How It Works, Pricing tiers, Footer
- **Login** (`/login`): Email/password login with Supabase Auth
- **Register** (`/register`): Sign-up form with Supabase Auth

### Protected Pages (require auth, redirect to `/login` if unauthenticated)
- **Dashboard** (`/dashboard`): Stats cards (total candidates, shortlisted, rejected), Recharts bar/pie charts
- **Upload Resume** (`/upload`): File upload (PDF/DOCX), "Analyze Resume" button, AI-parsed results (name, skills, experience, score, summary)
- **Candidates** (`/candidates`): Table with search/filter, shortlist/reject actions, CSV export button

## Layout
- **Sidebar** (always visible on protected routes): Dashboard, Upload Resume, Candidates, Logout
- **Top navbar** with logo, theme toggle, user info
- Responsive — collapsible sidebar on mobile

## Backend (Supabase + Lovable Cloud)

### Database Tables
- `candidates`: id, user_id, name, email, skills (text[]), experience (text), score (int), summary (text), status (shortlisted/rejected/pending), resume_url, created_at

### Auth
- Supabase Auth (email/password)
- Protected routes check session, redirect if unauthenticated

### Storage
- `resumes` bucket for uploaded PDF/DOCX files

### Edge Functions
1. **`analyze-resume`**: Receives uploaded file, extracts text (PDF/DOCX parsing), calls Lovable AI to extract name/skills/experience/score/summary, saves candidate to DB
2. **`export-candidates`**: Fetches user's candidates, returns CSV file with proper headers

## AI Features (Lovable AI Gateway)
- Resume text extraction and parsing via edge function
- AI extracts: name, skills, experience, job match score (0-100), summary
- Uses structured output (tool calling) for reliable JSON extraction

## Extra Features
- Toast notifications (success/error feedback)
- Loading spinners during upload/analysis
- Empty states for no candidates
- CSV export download
- Mobile responsive design
- Input validation on all forms


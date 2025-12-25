# EduFlow - Educational Platform

A modern educational platform built with React, TypeScript, and Supabase. Features include assignment management, study timer with Pomodoro technique, leaderboards, achievements, and a doubt resolution system.

## 🚀 Features

- **Dashboard** - Overview of assignments, study time, and achievements
- **Assignments** - Create and manage assignments (teachers) / View and submit (students)
- **Study Timer** - Pomodoro timer with session tracking and weekly statistics
- **Leaderboard** - Student rankings based on completed assignments and study time
- **Achievements** - Gamification with unlockable badges
- **Doubts System** - Students can ask questions, teachers can reply
- **Dark/Light Mode** - Theme switching support

## 📋 Prerequisites

- Node.js 18+ 
- npm or bun
- Supabase account (or use Lovable Cloud)
- Docker (optional, for containerized deployment)

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **State Management**: TanStack Query
- **Animations**: Framer Motion
- **Charts**: Recharts

---

## 🗄️ Supabase Backend Setup

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Enter a project name and database password
4. Select a region close to your users
5. Click **Create new project**

### Step 2: Database Schema

Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('student', 'teacher');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT
);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'student',
    UNIQUE (user_id)
);

-- Create assignments table
CREATE TABLE public.assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    teacher_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create submissions table
CREATE TABLE public.submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES public.assignments(id),
    student_id UUID NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    rank INTEGER,
    reflection TEXT
);

-- Create doubts table
CREATE TABLE public.doubts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES public.assignments(id),
    student_id UUID NOT NULL,
    question TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create doubt_replies table
CREATE TABLE public.doubt_replies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doubt_id UUID NOT NULL REFERENCES public.doubts(id),
    teacher_id UUID NOT NULL,
    reply TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create study_sessions table
CREATE TABLE public.study_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    subject TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create user_achievements table
CREATE TABLE public.user_achievements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    achievement_key TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### Step 3: Enable Row Level Security (RLS)

Run the following SQL to enable RLS and create policies:

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Helper function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Assignments policies
CREATE POLICY "Everyone can view assignments" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Teachers can create assignments" ON public.assignments FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own assignments" ON public.assignments FOR UPDATE USING (has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own assignments" ON public.assignments FOR DELETE USING (has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);

-- Submissions policies
CREATE POLICY "Students can view own submissions" ON public.submissions FOR SELECT USING (auth.uid() = student_id OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can create submissions" ON public.submissions FOR INSERT WITH CHECK (has_role(auth.uid(), 'student') AND auth.uid() = student_id);
CREATE POLICY "Students can update own submissions" ON public.submissions FOR UPDATE USING (auth.uid() = student_id);

-- Doubts policies
CREATE POLICY "Users can view doubts" ON public.doubts FOR SELECT USING (auth.uid() = student_id OR has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students can create doubts" ON public.doubts FOR INSERT WITH CHECK (has_role(auth.uid(), 'student') AND auth.uid() = student_id);

-- Doubt replies policies
CREATE POLICY "Users can view doubt replies" ON public.doubt_replies FOR SELECT USING (true);
CREATE POLICY "Teachers can create replies" ON public.doubt_replies FOR INSERT WITH CHECK (has_role(auth.uid(), 'teacher') AND auth.uid() = teacher_id);

-- Study sessions policies
CREATE POLICY "Users can view own study sessions" ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create study sessions" ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study sessions" ON public.study_sessions FOR UPDATE USING (auth.uid() = user_id);

-- User achievements policies
CREATE POLICY "Users can view own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can earn achievements" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Step 4: Create Database Functions and Triggers

```sql
-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger for assignments updated_at
CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;
```

### Step 5: Create Storage Bucket

```sql
-- Create avatars bucket for profile pictures
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Step 6: Configure Authentication

1. Go to **Authentication** > **Providers** in your Supabase dashboard
2. Enable **Email** provider
3. (Optional) Disable **Confirm email** for easier testing
4. (Optional) Enable **Google** OAuth - see [Google Auth Setup](#-google-oauth-setup)

### Step 7: Get API Keys

1. Go to **Settings** > **API** in your Supabase dashboard
2. Copy the **Project URL** and **anon/public** key
3. These will be used as environment variables

---

## 🔧 Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

For production, use `.env.production`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_APP_NAME=EduFlow
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
```

---

## 💻 Local Development

### Install Dependencies

```bash
npm install
# or
bun install
```

### Start Development Server

```bash
npm run dev
# or
bun dev
```

The app will be available at `http://localhost:5173`

---

## 🐳 Docker Deployment

### Build and Run

```bash
# Set environment variables
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
export VITE_SUPABASE_PROJECT_ID=your-project-id

# Build and run with Docker Compose
docker-compose up -d --build

# Or use the deploy script
chmod +x deploy.sh
./deploy.sh
```

### Manual Docker Build

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key \
  -t eduflow .

docker run -p 3000:80 eduflow
```

### Health Checks

The container includes health check endpoints:

| Endpoint | Description |
|----------|-------------|
| `/health` | Returns JSON status with timestamp |
| `/ready` | Readiness probe for orchestrators |
| `/live` | Simple liveness check |
| `/nginx-status` | Nginx metrics (internal only) |

---

## 🔐 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Choose **Web application**
6. Add authorized origins:
   - `http://localhost:5173` (development)
   - `https://your-domain.com` (production)
7. Add redirect URIs:
   - `https://your-project-id.supabase.co/auth/v1/callback`
8. Copy Client ID and Client Secret
9. In Supabase, go to **Authentication** > **Providers** > **Google**
10. Enable and paste the credentials

---

## 👥 User Roles

The app supports two roles:

| Role | Capabilities |
|------|-------------|
| **Student** | View assignments, submit work, ask doubts, use study timer, earn achievements |
| **Teacher** | Create/manage assignments, reply to doubts, view all submissions |

To assign a role after signup:

```sql
INSERT INTO public.user_roles (user_id, role) 
VALUES ('user-uuid-here', 'teacher');
```

---

## 📁 Project Structure

```
├── src/
│   ├── components/        # Reusable UI components
│   │   └── ui/            # shadcn/ui components
│   ├── contexts/          # React contexts (Auth, Theme)
│   ├── hooks/             # Custom React hooks
│   ├── integrations/      # Supabase client & types
│   ├── lib/               # Utility functions
│   ├── pages/             # Page components
│   └── styles/            # CSS modules
├── public/                # Static assets
├── supabase/              # Supabase config & edge functions
├── Dockerfile             # Docker build configuration
├── docker-compose.yml     # Docker Compose configuration
├── nginx.conf             # Nginx web server config
└── deploy.sh              # Production deployment script
```

---


### Edit Locally

```bash
git clone "https://github.com/karthik768990/EduFlow-Learning-Platform"
cd EDuFlow-Learning-Platform
npm install
npm run dev
```



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

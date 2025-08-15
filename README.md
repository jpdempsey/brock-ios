# Brock Brain - Backend API

Backend API for the Brock iOS personal training app, built with Next.js 14, Supabase, and OpenAI.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment variables:**
   Create a `.env.local` file with your keys:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=your-openai-api-key
   CRON_SECRET=your-secure-random-token-here
   ```

3. **Database setup:**
   Run the SQL in `database/schema.sql` in your Supabase SQL editor to set up the enhanced schema.

4. **Development:**
   ```bash
   npm run dev
   ```

## API Endpoints

### Goals

- `GET /api/goals` - Fetch all goals
- `POST /api/goals` - Create a new goal
- `GET /api/goals/[id]` - Get specific goal
- `PUT /api/goals/[id]` - Update specific goal
- `DELETE /api/goals/[id]` - Delete specific goal

### Activities

- `GET /api/activities` - Fetch all activities (optional: `?goal_id=uuid&limit=50`)
- `POST /api/activities` - Create a new activity
- `GET /api/activities/[id]` - Get specific activity
- `PUT /api/activities/[id]` - Update specific activity
- `DELETE /api/activities/[id]` - Delete specific activity

### Nutrition

- `GET /api/nutrition` - Fetch daily nutrition data (optional: `?date=2024-01-15&limit=30`)
- `POST /api/nutrition/upload` - Upload HealthKit nutrition entries

### Chat System

- `GET /api/threads` - Fetch all chat threads
- `POST /api/threads` - Create a new thread
- `GET /api/threads/[id]` - Get specific thread
- `PUT /api/threads/[id]` - Update thread (title, summary, etc.)
- `GET /api/threads/[id]/messages` - Get messages for a thread
- `POST /api/threads/[id]/messages` - Add message to thread
- `POST /api/chat` - Stream chat with Brock AI (Server-Sent Events)

### Proactive Check-ins

- `GET /api/threads/general-checkin` - Find general check-in thread
- `POST /api/threads/general-checkin` - Create general check-in thread
- `GET /api/threads/[id]/flags` - Get thread flags
- `PUT /api/threads/[id]/flags` - Update thread flags
- `POST /api/checkins/generate-schedule` - Generate daily check-in schedule (Vercel cron)
- `POST /api/checkins/check-time` - Check for scheduled check-ins (Vercel cron)
- `POST /api/checkins/send-proactive-message` - Send proactive check-in message

## Features

### AI Chat System

- **Streaming responses** with Server-Sent Events
- **Tool/function calling** - Brock can fetch goals, create activities, check nutrition data
- **Thread-based conversations** - Each chat has its own context and memory
- **Memory system** with global profile and thread-specific context
- **Automatic message persistence** to Supabase

### Proactive Check-ins

- **Automated daily scheduling** - Generates random check-in times within preferred windows
- **Morning check-ins** (7:30-10:30 AM ET) for motivation and goal-setting
- **Afternoon check-ins** (3:00-8:00 PM ET) for progress review and planning
- **Contextual messaging** - AI-generated messages based on recent activities and goals
- **Thread flagging system** - Easily identify and manage special-purpose threads
- **Vercel cron integration** - Reliable scheduling without external dependencies

### Available Tools

Brock can use these tools during conversations:

- `fetch_goals()` - Get current goals
- `create_goal()` - Create new goals
- `fetch_activities()` - Get recent activities
- `log_activity()` - Log new activities
- `fetch_daily_nutrition()` - Get nutrition data
- `get_current_time()` - Get current date/time

## Next Steps

1. Run the database schema migration
2. Add your OpenAI API key to `.env.local`
3. Test the API endpoints
4. Update your iOS app to use the new chat system

## Deployment

Deploy to Vercel:

```bash
vercel --prod
```

Make sure to set your environment variables in the Vercel dashboard.

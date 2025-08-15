# 🤖 Proactive Check-ins Setup Guide

This guide will help you set up Brock's proactive twice-daily check-in system.

## 🗂️ **What This Does**

Brock will now proactively reach out to you twice daily for accountability:

- **Morning** (7:30-10:30 AM ET): Motivational check-in to start your day
- **Afternoon** (3:00-8:00 PM ET): Progress review and planning ahead

The times are randomly generated each day within these windows to keep things natural and unpredictable.

## 🚀 **Setup Steps**

### 1. **Database Migration**

Run the updated schema in your Supabase SQL editor:

```bash
# The schema.sql file has been updated with:
# - Thread flags support (for marking general check-in thread)
# - Daily check-in scheduling table
# - Proper indexes and RLS policies
```

### 2. **Environment Variables**

Add this to your `.env.local` file:

```bash
# Existing variables...
CRON_SECRET=your-secure-random-token-here
```

**Important:** Generate a secure random token for `CRON_SECRET`. This protects your cron endpoints from unauthorized access.

### 3. **Vercel Deployment**

The system uses Vercel's built-in cron jobs (configured in `vercel.json`):

- **Daily at 1AM ET** (`0 6 * * *` UTC): Generates random check-in times for the day
- **Every 15 minutes** (`*/15 * * * *`): Checks if it's time to send a check-in message

Deploy to Vercel:

```bash
vercel --prod
```

### 4. **Vercel Environment Variables**

In your Vercel dashboard, make sure to set:

- `CRON_SECRET` - Your secure token
- All other existing environment variables

### 5. **Create General Check-in Thread**

The system will automatically create a "Daily Check-ins" thread when it sends the first proactive message.

Or you can create it manually via API:

```bash
curl -X POST https://your-domain.vercel.app/api/threads/general-checkin \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily Check-ins",
    "topic": "Daily accountability and progress check-ins"
  }'
```

## 🔧 **API Endpoints**

### **Cron Endpoints** (Protected by CRON_SECRET)

- `POST /api/checkins/generate-schedule` - Generate daily random times
- `POST /api/checkins/check-time` - Check if it's time for a check-in
- `POST /api/checkins/send-proactive-message` - Send the actual message

### **Management Endpoints**

- `GET /api/threads/general-checkin` - Find the general check-in thread
- `POST /api/threads/general-checkin` - Create/update general check-in thread
- `GET /api/threads/[id]/flags` - View thread flags
- `PUT /api/threads/[id]/flags` - Update thread flags

## 🎯 **How It Works**

### **Daily Schedule Generation (1AM ET)**

1. Vercel cron triggers `/api/checkins/generate-schedule`
2. System generates random times:
   - Morning: Random time between 7:30-10:30 AM ET
   - Afternoon: Random time between 3:00-8:00 PM ET
3. Times stored in `daily_checkin_schedule` table

### **Time Monitoring (Every 15 Minutes)**

1. Vercel cron triggers `/api/checkins/check-time`
2. System checks current ET time against scheduled times
3. If it's time for a check-in and not yet sent:
   - Calls `/api/checkins/send-proactive-message`
   - Generates contextual AI message based on your recent activities/goals
   - Sends to general check-in thread
   - Marks check-in as sent

### **Message Generation**

- Uses OpenAI GPT-4o-mini with contextual prompts
- References your recent activities and active goals
- Tailored messaging for morning vs afternoon
- Encouraging and personal tone

## 🔍 **Testing**

### **Manual Testing**

Test the schedule generation:

```bash
curl -X POST https://your-domain.vercel.app/api/checkins/generate-schedule \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Test time checking:

```bash
curl -X POST https://your-domain.vercel.app/api/checkins/check-time \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Test proactive messaging:

```bash
curl -X POST https://your-domain.vercel.app/api/checkins/send-proactive-message \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"timeOfDay": "morning"}'
```

### **Check Vercel Cron Logs**

In your Vercel dashboard:

1. Go to your project
2. Click "Functions" tab
3. Look for cron function executions
4. Check logs for any errors

## 🛠️ **Customization**

### **Change Check-in Times**

Edit the time windows in `/api/checkins/generate-schedule/route.ts`:

```typescript
const morningTime = generateRandomTime(7, 30, 10, 30); // 7:30-10:30 AM
const afternoonTime = generateRandomTime(15, 0, 20, 0); // 3:00-8:00 PM
```

### **Customize Messages**

Edit the prompt in `/api/checkins/send-proactive-message/route.ts` in the `buildProactiveMessagePrompt` function.

### **Change Frequency**

Edit `vercel.json` to adjust cron schedules:

- Schedule generation: Currently daily at 1AM ET
- Time checking: Currently every 15 minutes

## 🚨 **Troubleshooting**

### **Messages Not Sending**

1. Check Vercel cron logs for errors
2. Verify `CRON_SECRET` is set correctly
3. Ensure database schema is updated
4. Check if general check-in thread exists

### **Wrong Timezone**

The system uses `America/New_York` (ET) timezone. Times are converted automatically.

### **Multiple Check-in Threads**

Only one thread should have the `is_general_checkin: true` flag. Use the management APIs to fix if needed.

## 📱 **iOS App Integration**

No changes needed! The iOS app will:

- Receive proactive messages like normal Brock messages
- Get push notifications via existing notification system
- Display messages in the general check-in thread

## 🎉 **You're All Set!**

Once deployed, Brock will start reaching out proactively:

- First schedule generation happens at 1AM ET the night after deployment
- First check-in message will be sent at the randomly generated time
- Messages will be contextual and encouraging based on your recent activities

The system is designed to be:

- ✅ Reliable (Vercel cron handles scheduling)
- ✅ Secure (CRON_SECRET protects endpoints)
- ✅ Contextual (AI-generated based on your data)
- ✅ Natural (random times within windows)
- ✅ Extensible (easy to add more proactive features)

Enjoy your new proactive AI trainer! 💪

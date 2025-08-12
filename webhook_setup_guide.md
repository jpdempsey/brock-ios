# Strava Webhook Setup Guide

## 🔧 Environment Variables

Add this to your `.env.local` file:

```bash
# Existing variables
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=93baf91065ea0219845768efc00e6cca062445b2
NEXTAUTH_URL=http://localhost:3000

# New webhook variable
STRAVA_WEBHOOK_VERIFY_TOKEN=BROCK_STRAVA_WEBHOOK_2025
```

## 🚀 Setup Steps

### 1. **Test Webhook Endpoint**

First, make sure your webhook endpoint is working:

```bash
curl http://localhost:3000/api/webhooks/strava
```

### 2. **Create Webhook Subscription**

```bash
curl -X POST http://localhost:3000/api/strava/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "create"}'
```

### 3. **Check Subscription Status**

```bash
curl http://localhost:3000/api/strava/webhook
```

### 4. **Test Real-Time Sync**

- Go for a run/ride and track it on Strava
- Your activity should automatically appear in your activities API within seconds!

## 🔍 Troubleshooting

### **Check Current Subscriptions**

```bash
curl -X POST http://localhost:3000/api/strava/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}'
```

### **Delete All Subscriptions** (if needed)

```bash
curl -X POST http://localhost:3000/api/strava/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "delete"}'
```

### **Monitor Webhook Events**

Watch your terminal/logs when you complete activities on Strava to see the webhook events coming in.

## 🎯 What Happens Next

Once the webhook is set up:

1. **Complete an activity** on Strava (run, ride, workout)
2. **Strava sends webhook** to your endpoint within seconds
3. **Activity automatically synced** to your database
4. **Appears in iOS app** immediately - no manual sync needed!

## 📱 Production Setup

For production (when you deploy):

1. **Update NEXTAUTH_URL** to your production domain
2. **Update Strava app callback domain** to your production domain
3. **Recreate webhook subscription** with production URL

## 🔐 Security Notes

- The webhook verify token (`BROCK_STRAVA_WEBHOOK_2025`) ensures only Strava can trigger your webhook
- All webhook events are logged for debugging
- Failed webhook processing won't break your app

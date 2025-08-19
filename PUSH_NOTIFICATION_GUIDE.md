# 📱 Real Push Notifications Implementation Guide

This guide will help you implement **real push notifications** for your BarterHaven app. Currently, you have a mock system that works in development. To get actual push notifications, follow these steps:

## 🚀 **Step 1: Switch to EAS Build (Required)**

Push notifications require native modules that only work with EAS Build, not Expo Go.

### Initialize EAS Build:
```bash
eas login
eas build:configure
```

### Create Development Build:
```bash
# For Android
eas build --platform android --profile development

# For iOS  
eas build --platform ios --profile development

# For both
eas build --platform all --profile development
```

### Install Development Build:
- **Android**: Download and install the APK from the build
- **iOS**: Use TestFlight or install directly via USB

## 🔧 **Step 2: Update Context to Use Production Service**

Update `context/NotificationContext.jsx`:

```javascript
// Change this line:
import NotificationService from '@/app/services/notificationServiceMock';

// To this:
import NotificationService from '@/app/services/productionNotificationService';
```

## 📱 **Step 3: Test Push Notifications**

### Development Testing:
1. Run your development build (not Expo Go)
2. The service will automatically detect device vs simulator
3. Real device = real notifications, simulator = mock notifications

### Production Testing:
```bash
# Build for production
eas build --platform all --profile production
```

## 🔔 **Step 4: Backend Push Notification Functions**

Add these Supabase Edge Functions for automated notifications:

### Create Edge Function for Message Notifications:
```sql
-- In your Supabase SQL editor
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
    receiver_push_tokens RECORD;
    sender_name TEXT;
    notification_title TEXT;
    notification_body TEXT;
BEGIN
    -- Get sender's name
    SELECT name INTO sender_name 
    FROM users 
    WHERE id = NEW.sender_id;
    
    -- Prepare notification content
    notification_title := 'New Message';
    notification_body := 'You have a new message from ' || COALESCE(sender_name, 'someone');
    
    -- Insert notification record
    INSERT INTO notifications (
        user_id,
        type,
        title,
        body,
        data,
        is_read,
        created_at
    ) VALUES (
        NEW.receiver_id,
        'message',
        notification_title,
        notification_body,
        jsonb_build_object(
            'messageId', NEW.id,
            'senderId', NEW.sender_id,
            'type', 'message'
        ),
        false,
        NOW()
    );
    
    -- Send push notification via HTTP request to your notification service
    -- This would typically be handled by your app backend
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_notify_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_message();
```

### Create Edge Function for Trade Notifications:
```sql
CREATE OR REPLACE FUNCTION notify_trade_update()
RETURNS TRIGGER AS $$
DECLARE
    notification_title TEXT;
    notification_body TEXT;
    status_messages jsonb;
BEGIN
    -- Only notify on status changes
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Define status messages
    status_messages := jsonb_build_object(
        'pending', 'Trade proposal received',
        'accepted', 'Trade proposal accepted!',
        'rejected', 'Trade proposal declined',
        'completed', 'Trade completed successfully!'
    );
    
    notification_title := 'Trade Update';
    notification_body := COALESCE(status_messages->>NEW.status, 'Your trade has been updated');
    
    -- Insert notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        body,
        data,
        is_read,
        created_at
    ) VALUES (
        NEW.receiver_id,
        'trade_update',
        notification_title,
        notification_body,
        jsonb_build_object(
            'tradeId', NEW.id,
            'status', NEW.status,
            'type', 'trade_update'
        ),
        false,
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_notify_trade_update
    AFTER UPDATE ON trade_proposals
    FOR EACH ROW
    EXECUTE FUNCTION notify_trade_update();
```

## 🎯 **Step 5: Server-Side Push Notification Service**

Create a backend service to actually send push notifications:

### Option A: Node.js Service
```javascript
// pushNotificationService.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendPushNotifications() {
  try {
    // Get pending notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        user_push_tokens!inner(push_token, device_type)
      `)
      .eq('is_sent', false)
      .eq('user_push_tokens.is_active', true);

    if (error) throw error;

    for (const notification of notifications) {
      const messages = notification.user_push_tokens.map(token => ({
        to: token.push_token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data
      }));

      // Send via Expo Push API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      
      // Mark as sent
      await supabase
        .from('notifications')
        .update({ is_sent: true })
        .eq('id', notification.id);
    }
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

// Run every 30 seconds
setInterval(sendPushNotifications, 30000);
```

### Option B: Supabase Edge Function
```typescript
// supabase/functions/send-push-notifications/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get pending notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        *,
        user_push_tokens!inner(push_token, device_type)
      `)
      .eq('is_sent', false)
      .eq('user_push_tokens.is_active', true)

    if (error) throw error

    for (const notification of notifications) {
      const messages = notification.user_push_tokens.map(token => ({
        to: token.push_token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data
      }))

      // Send via Expo Push API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })

      const result = await response.json()
      
      // Mark as sent
      await supabase
        .from('notifications')
        .update({ is_sent: true })
        .eq('id', notification.id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
```

## 🔄 **Step 6: Set Up Automated Triggers**

### Option A: Cron Job (Recommended)
Set up a cron job to run your notification service every minute:
```bash
# Add to your server's crontab
* * * * * /usr/bin/node /path/to/pushNotificationService.js
```

### Option B: Supabase Cron (if using Edge Functions)
```sql
-- Schedule the edge function to run every minute
SELECT cron.schedule(
  'send-push-notifications',
  '* * * * *',
  'https://your-project.supabase.co/functions/v1/send-push-notifications'
);
```

## 🧪 **Step 7: Testing Real Notifications**

### Test Script:
```javascript
// testNotification.js - Run this to test notifications
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);

async function testNotification(userId) {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'test',
      title: 'Test Notification',
      body: 'This is a test push notification!',
      data: { type: 'test' },
      is_read: false
    });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Test notification created!');
  }
}

// Replace with actual user ID
testNotification('your-user-id-here');
```

## 🚀 **Step 8: Production Deployment**

### Build for Production:
```bash
# Build production version
eas build --platform all --profile production

# Submit to app stores
eas submit --platform all
```

### Enable Production Notifications:
1. **iOS**: Configure APNs in Apple Developer Console
2. **Android**: Firebase Cloud Messaging is handled automatically by Expo
3. **Test thoroughly** on real devices before app store submission

## 📊 **Step 9: Monitoring & Analytics**

### Track Notification Performance:
```sql
-- Add to your database
CREATE TABLE notification_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id uuid REFERENCES notifications(id),
  event_type TEXT, -- 'sent', 'delivered', 'opened', 'failed'
  user_id uuid REFERENCES users(id),
  device_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Monitor with Queries:
```sql
-- Notification delivery rates
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN event_type = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as opened
FROM notification_analytics 
WHERE event_type IN ('sent', 'delivered', 'opened')
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## 🎯 **Current Status**

✅ **Development**: Mock notifications working in Expo Go  
🔨 **Next Steps**: Build with EAS for real notifications  
🚀 **Production**: Follow this guide for full implementation  

## 📝 **Quick Start Commands**

```bash
# 1. Build development version
eas build --platform android --profile development

# 2. Install and test on real device
# 3. Update context to use production service
# 4. Set up backend notification service
# 5. Test with real notifications
```

Your notification system is ready for production! 🎉 
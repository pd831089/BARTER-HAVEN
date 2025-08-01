# BarterHaven Notification System Implementation

## Overview

This document outlines the comprehensive notification system implemented for the BarterHaven mobile app, including push notifications, real-time badges, and user preferences management.

## Features Implemented

### ✅ Core Notification Features

1. **Push Notifications for New Messages**
   - Real-time notifications when users receive chat messages
   - Sender name and message preview
   - Automatic navigation to chat when tapped

2. **Trade Status Update Notifications**
   - Notifications for trade proposal acceptances/rejections
   - Trade completion confirmations
   - Trade cancellations and disputes

3. **Match Suggestions Notifications**
   - Notifications when potential matches are found for user's items
   - Smart matching based on category, tags, value, and location

4. **Trade Reminder Notifications**
   - Automatic reminders for pending trades older than 24 hours
   - Separate reminders for proposers and receivers

5. **Real-time Notification Badges**
   - Badge count on notification bell icon
   - Badge count on chat tab for unread messages
   - Real-time updates using Supabase subscriptions

6. **Comprehensive Notification Preferences**
   - Enable/disable push notifications
   - Toggle specific notification types (messages, trades, matches, reminders)
   - Quiet hours configuration
   - Email notification preferences

## Architecture

### Database Schema

#### Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    type VARCHAR(50), -- 'message', 'trade_update', 'match_suggestion', 'trade_reminder'
    title TEXT,
    body TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Notification Preferences Table
```sql
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    messages BOOLEAN DEFAULT TRUE,
    trades BOOLEAN DEFAULT TRUE,
    matches BOOLEAN DEFAULT TRUE,
    reminders BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00'
);
```

#### User Push Tokens Table
```sql
CREATE TABLE user_push_tokens (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    push_token TEXT,
    device_type VARCHAR(20), -- 'ios', 'android'
    is_active BOOLEAN DEFAULT TRUE
);
```

### Service Layer

#### NotificationService (`app/services/notificationService.js`)
- Handles push notification registration
- Manages real-time subscriptions
- Processes notification sending logic
- Implements quiet hours and preference checking
- Manages badge counts

#### NotificationContext (`context/NotificationContext.jsx`)
- React context for notification state management
- Real-time notification count updates
- Preference management
- Integration with UI components

## Components

### NotificationCenter (`app/components/NotificationCenter.jsx`)
- Full-screen modal for viewing notifications
- Filterable tabs (All, Unread, Messages, Trades, Matches, Reminders)
- Mark as read/delete functionality
- Pull-to-refresh support

### NotificationPreferences (`app/components/NotificationPreferences.jsx`)
- Comprehensive settings modal
- Toggle switches for all notification types
- Time picker for quiet hours
- Save/reset functionality

## Integration Points

### Tab Navigation
- Notification bell icon in header with badge count
- Chat tab badge for unread messages
- Real-time updates via context

### Settings Screen
- Notification preferences access
- Integration with main settings

### Chat System
- Automatic notification sending on new messages
- Read status integration

### Trade System
- Status change notifications
- Completion confirmations
- Reminder scheduling

## Real-time Features

### Supabase Subscriptions
- Listen for new notifications
- Update badge counts automatically
- Real-time UI updates

### Badge Management
- Expo badge count integration
- Persistent badge state
- Automatic updates on read/unread

## Configuration

### App.json Updates
```json
{
  "plugins": [
    [
      "expo-notifications",
      {
        "icon": "./assets/images/icon.png",
        "color": "#075eec",
        "sounds": ["./assets/sounds/notification.wav"],
        "mode": "production"
      }
    ]
  ]
}
```

### Required Packages
```json
{
  "expo-notifications": "latest",
  "expo-device": "latest",
  "expo-constants": "latest",
  "@react-native-community/datetimepicker": "latest"
}
```

## Usage Examples

### Initialize Notification Service
```javascript
import NotificationService from '@/app/services/notificationService';
import { useAuth } from '@/Config/AuthContext';

const { user } = useAuth();
useEffect(() => {
  if (user?.id) {
    NotificationService.initialize(user.id);
  }
}, [user?.id]);
```

### Access Notification Data
```javascript
import { useNotifications } from '@/context/NotificationContext';

const {
  notificationCounts,
  notifications,
  markNotificationAsRead,
  updateNotificationPreferences
} = useNotifications();
```

### Send Custom Notification
```javascript
await NotificationService.sendPushNotification({
  title: 'Custom Notification',
  body: 'This is a custom notification',
  data: {
    type: 'custom',
    customData: 'value'
  }
});
```

## Database Functions

### Get Notification Counts
```sql
SELECT * FROM get_user_notification_count('user-id');
```

### Mark Notifications as Read
```sql
SELECT mark_notifications_as_read('user-id', notification_ids_array, 'notification_type');
```

### Cleanup Old Notifications
```sql
SELECT cleanup_old_notifications(); -- Removes read notifications older than 30 days
```

## Security Features

### Row Level Security (RLS)
- Users can only access their own notifications
- Secure token management
- Protected notification preferences

### Data Validation
- Input sanitization
- Notification type validation
- User permission checks

## Performance Optimizations

### Efficient Queries
- Indexed database tables
- Paginated notification loading
- Optimized real-time subscriptions

### Memory Management
- Automatic cleanup of old notifications
- Efficient state management
- Minimal re-renders

## Testing

### Unit Tests
- NotificationService methods
- Context state management
- Component rendering

### Integration Tests
- End-to-end notification flow
- Real-time subscription testing
- Database function testing

## Deployment Considerations

### Push Notification Setup
1. Configure Expo Push Notification service
2. Set up production push certificates (iOS)
3. Configure Firebase Cloud Messaging (Android)

### Database Migration
1. Run the notification system migration
2. Create indexes for performance
3. Set up RLS policies

### Environment Configuration
- Set Expo project ID in app.json
- Configure push notification credentials
- Set up production database

## Monitoring and Analytics

### Notification Metrics
- Delivery rates
- Open rates
- User engagement
- Error tracking

### Performance Monitoring
- Database query performance
- Real-time subscription health
- Memory usage tracking

## Future Enhancements

### Planned Features
1. **Rich Notifications**
   - Images in notifications
   - Action buttons
   - Custom sounds per type

2. **Advanced Scheduling**
   - Custom reminder intervals
   - Recurring notifications
   - Time zone awareness

3. **Analytics Dashboard**
   - Notification performance metrics
   - User engagement analytics
   - A/B testing support

4. **Email Integration**
   - HTML email templates
   - Email notification sending
   - Unsubscribe management

### Scalability Improvements
- Notification queuing system
- Batch processing
- CDN for notification assets
- Multi-region support

## Troubleshooting

### Common Issues

1. **Notifications Not Received**
   - Check push token registration
   - Verify user preferences
   - Check quiet hours settings
   - Validate Expo push service configuration

2. **Badge Count Inconsistencies**
   - Refresh notification counts
   - Clear app cache
   - Check real-time subscription status

3. **Performance Issues**
   - Monitor database query performance
   - Check subscription count
   - Verify memory usage

### Debug Tools
- Expo push notification tool
- Database query logs
- Real-time subscription status
- Badge count verification

## Support

For technical support or questions about the notification system:
- Check the troubleshooting section
- Review database logs
- Test with Expo push notification tool
- Contact the development team

---

This notification system provides a robust, scalable foundation for user engagement in the BarterHaven app, with comprehensive features for managing all types of notifications while maintaining performance and user privacy. 
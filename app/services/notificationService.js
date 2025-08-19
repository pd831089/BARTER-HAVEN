import { Platform } from 'react-native';
import { supabase } from '@/Config/supabaseConfig';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.userId = null;
    this.pushToken = null;
    this.subscriptions = [];
    this.badgeCount = 0;
    this.isNativeAvailable = false;
    this.notificationListeners = [];
  }

  async initialize(userId) {
    if (!userId || userId === "null") return;
    if (this.isInitialized) return;
    
    this.userId = userId;
    
    try {
      // Check if native modules are available
      if (!__DEV__ && Platform.OS !== 'web') {
        const Notifications = await import('expo-notifications');
        const Device = await import('expo-device');
        const Constants = await import('expo-constants');
        
        this.Notifications = Notifications;
        this.Device = Device;
        this.Constants = Constants;
        this.isNativeAvailable = true;
        
        console.log('Notification service: Native modules available');
        await this.setupNativeNotifications();
      } else {
        console.log('Notification service: Using mock mode for development');
        await this.setupMockNotifications();
      }
    } catch (error) {
      console.warn('Native notification modules not available, using mock mode');
      this.isNativeAvailable = false;
      await this.setupMockNotifications();
    }
    
    // Setup database subscriptions
    await this.setupDatabaseSubscriptions();
    
    this.isInitialized = true;
    console.log('Notification service initialized for user:', userId);
  }

  async setupNativeNotifications() {
    try {
      // Configure notification behavior
      await this.Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Register for push notifications
      await this.registerForPushNotifications();
      
      // Setup notification listeners
      this.setupNotificationListeners();
      
      // Update badge count
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error setting up native notifications:', error);
    }
  }

  async setupMockNotifications() {
    // Mock token registration
    this.pushToken = `mock-push-token-${this.userId}-${Date.now()}`;
    console.log('Mock: Push token registered:', this.pushToken);
    
    // Store mock token in database
    await this.storePushToken(this.pushToken);
  }

  async registerForPushNotifications() {
    try {
      if (!this.Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return;
      }

      const { status: existingStatus } = await this.Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await this.Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }

      const token = await this.Notifications.getExpoPushTokenAsync({
        projectId: this.Constants.expoConfig?.extra?.eas?.projectId,
      });

      this.pushToken = token.data;
      console.log('Push token registered:', this.pushToken);
      
      // Store token in database
      await this.storePushToken(this.pushToken);
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  }

  async storePushToken(token) {
    if (!this.userId || this.userId === "null") return;
    try {
      // Check if user_push_tokens table exists, if not skip storage
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: this.userId,
          push_token: token,
          platform: this.isNativeAvailable ? Platform.OS : 'web',
          device_type: this.isNativeAvailable ? 'mobile' : 'web',
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.warn('Push token storage failed (table may not exist):', error.message);
        // Don't throw error, just log it
      }
    } catch (error) {
      console.warn('Error storing push token:', error);
    }
  }

  setupNotificationListeners() {
    if (!this.isNativeAvailable) return;

    // Notification received while app is foregrounded
    const receivedListener = this.Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Notification tapped
    const responseListener = this.Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      this.handleNotificationTapped(response);
    });

    this.notificationListeners = [receivedListener, responseListener];
  }

  handleNotificationReceived(notification) {
    // Update badge count
    this.updateBadgeCount();
    
    // Notify listeners
    this.notifyListeners('received', notification);
  }

  handleNotificationTapped(response) {
    const { notification } = response;
    const data = notification.request.content.data;
    
    // Handle navigation based on notification type
    if (data?.type === 'message' && data?.userId) {
      // Navigate to chat with specific user
      console.log('Navigate to chat:', data.userId);
    } else if (data?.type === 'trade_update' && data?.tradeId) {
      // Navigate to trade details
      console.log('Navigate to trade:', data.tradeId);
    }
    
    // Mark notification as read
    if (data?.notificationId) {
      this.markAsRead(data.notificationId);
    }
    
    // Notify listeners
    this.notifyListeners('tapped', response);
  }

  async setupDatabaseSubscriptions() {
    if (!this.userId || this.userId === "null") return;
    try {
      // Clean up existing subscriptions first
      this.cleanup();
      
      // Subscribe to new notifications
      const notificationSubscription = supabase
        .channel(`notifications_${this.userId}_${Date.now()}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${this.userId}`
        }, (payload) => {
          console.log('New notification received:', payload.new);
          this.handleDatabaseNotification(payload.new);
        })
        .subscribe();

      // Subscribe to message count changes
      const messageSubscription = supabase
        .channel(`messages_${this.userId}_${Date.now()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${this.userId}`
        }, () => {
          this.updateBadgeCount();
        })
        .subscribe();

      this.subscriptions = [notificationSubscription, messageSubscription];
    } catch (error) {
      console.error('Error setting up database subscriptions:', error);
    }
  }

  handleDatabaseNotification(notification) {
    // Update badge count
    this.updateBadgeCount();
    
    // Send push notification if app is in background
    if (this.isNativeAvailable && Platform.OS !== 'web') {
      this.sendLocalNotification(notification);
    } else {
      // In development, just log
      console.log('Mock: Push notification would be sent:', notification);
    }
  }

  async sendLocalNotification(notification) {
    try {
      if (!this.isNativeAvailable) return;

      await this.Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: {
            notificationId: notification.id,
            type: notification.type,
            ...notification.data,
          },
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  async updateBadgeCount() {
    try {
      if (!this.userId) {
        console.warn('No user ID available for badge count update');
        return;
      }

      // Get unread notification count
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', this.userId)
        .eq('read', false);

      // Get unread message count
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', this.userId)
        .is('read_at', null)
        .is('deleted_at', null);

      if (notifError && !notifError.message.includes('relation "notifications" does not exist')) {
        console.error('Error getting notification counts:', notifError);
      }
      
      if (msgError && !msgError.message.includes('relation "messages" does not exist')) {
        console.error('Error getting message counts:', msgError);
      }

      const notificationCount = notifications?.length || 0;
      const messageCount = messages?.length || 0;
      const totalCount = notificationCount + messageCount;
      
      this.badgeCount = totalCount;

      // Update app badge
      if (this.isNativeAvailable) {
        await this.Notifications.setBadgeCountAsync(totalCount);
      }

      // Notify listeners
      this.notifyListeners('badgeUpdate', totalCount);
      
      console.log('Badge count updated:', totalCount);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) throw error;
      
      // Update badge count
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead() {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', this.userId)
        .eq('read', false);

      if (error) throw error;
      
      // Update badge count
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  async getNotifications(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async deleteNotification(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', this.userId);

      if (error) throw error;
      
      // Update badge count
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  // Add notification listener
  addListener(callback) {
    this.notificationListeners.push(callback);
    return () => {
      const index = this.notificationListeners.indexOf(callback);
      if (index > -1) {
        this.notificationListeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  notifyListeners(event, data) {
    this.notificationListeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  // Get current badge count
  getBadgeCount() {
    return this.badgeCount;
  }

  // Check if notifications are enabled
  async areNotificationsEnabled() {
    if (!this.isNativeAvailable) return false;
    
    try {
      const { status } = await this.Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }

  // Cleanup
  cleanup() {
    // Only cleanup if we were initialized
    if (!this.isInitialized) return;
    
    // Unsubscribe from database subscriptions
    this.subscriptions.forEach(subscription => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing:', error);
      }
    });
    this.subscriptions = [];

    // Remove notification listeners
    if (this.isNativeAvailable && this.notificationListeners.length > 0) {
      this.notificationListeners.forEach(listener => {
        try {
          if (listener && typeof listener.remove === 'function') {
            listener.remove();
          }
        } catch (error) {
          console.warn('Error removing listener:', error);
        }
      });
    }
    this.notificationListeners = [];

    this.isInitialized = false;
    this.userId = null;
    console.log('Notification service cleaned up');
  }
}

export default new NotificationService(); 
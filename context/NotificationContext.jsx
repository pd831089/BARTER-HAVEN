import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/Config/AuthContext';
import NotificationService from '@/app/services/notificationService';
import { supabase } from '@/Config/supabaseConfig';

// Simple mock notification service for development
const mockNotificationService = {
  isInitialized: false,
  userId: null,

  async initialize(userId) {
    if (this.isInitialized) return;
    this.userId = userId;
    console.log('Mock: Initializing notification service for user:', userId);
    
    // Mock token registration
    const mockToken = `mock-push-token-${userId}-${Date.now()}`;
    console.log('Mock: Push token registered:', mockToken);
    
    this.isInitialized = true;
    console.log('Mock: Notification service initialized successfully');
  },

  async updateBadgeCount() {
    console.log('Mock: Badge count updated to: 0');
  },

  async updateNotificationPreferences(preferences) {
    console.log('Mock: Notification preferences updated:', preferences);
  },

  async sendTradeReminders() {
    console.log('Mock: Trade reminders sent');
  },

  cleanup() {
    console.log('Mock: Cleaning up notification service');
    this.isInitialized = false;
    this.userId = null;
  }
};

const NotificationContext = createContext({});

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [chatBadgeCount, setChatBadgeCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize notification service when user is available
  useEffect(() => {
    if (user?.id) {
      initializeNotifications();
    } else {
      cleanupNotifications();
    }

    return () => cleanupNotifications();
  }, [user?.id]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && user?.id) {
        // App became active, update badge counts
        updateBadgeCounts();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [user?.id]);

  const initializeNotifications = async () => {
    try {
      console.log('Initializing notifications for user:', user.id);
      
      // Initialize the notification service
      await NotificationService.initialize(user.id);
      
      // Setup listener for badge updates
      const unsubscribe = NotificationService.addListener(async (event, data) => {
        if (event === 'badgeUpdate') {
          // Get the latest counts from backend and update state directly
          if (user?.id) {
            // Get notification count
            const totalCount = NotificationService.getBadgeCount();
            setNotificationCount(totalCount);
            // Get chat-specific unread count
            const { data: chatData, error } = await supabase
              .from('messages')
              .select('id')
              .eq('receiver_id', user.id)
              .is('read_at', null)
              .is('deleted_at', null);
            setChatBadgeCount(chatData?.length || 0);
          }
        } else if (event === 'received') {
          // Refresh notifications when new one is received
          refreshNotifications();
        }
      });

      // Initial badge count update
      await updateBadgeCounts();
      
      // Load initial notifications
      await refreshNotifications();

      return unsubscribe;
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  const cleanupNotifications = () => {
    NotificationService.cleanup();
    setNotificationCount(0);
    setChatBadgeCount(0);
    setNotifications([]);
  };

  const updateBadgeCounts = useCallback(async () => {
    try {
      if (!user?.id) return;
      
      // Update overall notification count
      await NotificationService.updateBadgeCount();
      const totalCount = NotificationService.getBadgeCount();
      setNotificationCount(totalCount);

      // Get chat-specific unread count
      const chatCount = await getChatUnreadCount();
      setChatBadgeCount(chatCount);
    } catch (error) {
      console.error('Error updating badge counts:', error);
    }
  }, [user?.id]);

  const getChatUnreadCount = async () => {
    try {
      if (!user?.id) return 0;
      
      // This could be moved to ChatService if needed
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .is('read_at', null)
        .is('deleted_at', null);

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting chat unread count:', error);
      return 0;
    }
  };

  const refreshNotifications = async () => {
    try {
      setLoading(true);
      const notificationData = await NotificationService.getNotifications(50, 0);
      setNotifications(notificationData);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await NotificationService.markAsRead(notificationId);
      await refreshNotifications();
      await updateBadgeCounts();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      await refreshNotifications();
      await updateBadgeCounts();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await NotificationService.deleteNotification(notificationId);
      await refreshNotifications();
      await updateBadgeCounts();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const areNotificationsEnabled = async () => {
    try {
      return await NotificationService.areNotificationsEnabled();
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  };

  const value = {
    // State
    notificationCount,
    chatBadgeCount,
    notifications,
    loading,
    
    // Actions
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updateBadgeCounts,
    areNotificationsEnabled,
    
    // Service access
    notificationService: NotificationService,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 
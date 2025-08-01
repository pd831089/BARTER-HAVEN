import { supabase } from '@/Config/supabaseConfig';

class ChatService {
  constructor() {
    this.subscriptions = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('Chat service initialized');
  }

  // Get all chat users with last message info
  async getChatUsers(userId) {
    if (!userId || userId === "null") return [];
    try {
      // Get all users except current user
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, profile_image_url')
        .neq('id', userId);

      if (usersError) throw usersError;

      // Get chat participants with last messages
      const { data: participants, error: participantsError } = await supabase
        .rpc('get_chat_participants', { user_id: userId });

      if (participantsError) {
        console.warn('Chat participants function not available, using fallback');
        return allUsers.map(user => ({ ...user, unread_count: 0 }));
      }

      // Combine users with chat info
      const enrichedUsers = allUsers.map(u => {
        const participantInfo = participants?.find(p => p.participant_id === u.id);
        return {
          ...u,
          last_message_at: participantInfo?.last_message_at || null,
          unread_count: participantInfo?.unread_count || 0
        };
      }).sort((a, b) => {
        // Sort by last message time
        if (a.last_message_at && !b.last_message_at) return -1;
        if (!a.last_message_at && b.last_message_at) return 1;
        if (a.last_message_at && b.last_message_at) {
          return new Date(b.last_message_at) - new Date(a.last_message_at);
        }
        return (a.name || a.email).localeCompare(b.name || b.email);
      });

      return enrichedUsers;
    } catch (error) {
      console.error('Error getting chat users:', error);
      throw error;
    }
  }

  // Get messages between two users
  async getMessages(userId, otherUserId) {
    if (!userId || userId === "null" || !otherUserId || otherUserId === "null") return [];
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Mark unread messages as read
      const unreadMessages = messages?.filter(msg => 
        msg.receiver_id === userId && !msg.read_at
      ) || [];
      
      if (unreadMessages.length > 0) {
        await this.markMessagesAsRead(unreadMessages.map(msg => msg.id));
      }

      return messages || [];
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  // Enhanced: Send a message (optionally linked to a trade)
  async sendMessage({ senderId, receiverId, content, tradeId = null, type = 'text' }) {
    if (!senderId || senderId === "null" || !receiverId || receiverId === "null") return;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        trade_id: tradeId,
        type,
        status: 'sent',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Mark messages as read
  async markMessagesAsRead(messageIds) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', messageIds);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Subscribe to messages for a conversation
  subscribeToMessages(userId, otherUserId, callback) {
    const subscriptionKey = `${userId}-${otherUserId}`;
    
    // Clean up existing subscription
    this.unsubscribeFromMessages(subscriptionKey);

    const messageFilter = `or(and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId}))`;

    const subscription = supabase
      .channel(`messages_${subscriptionKey}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: messageFilter
      }, (payload) => {
        console.log('Message update received:', payload.eventType);
        callback(payload);
      })
      .subscribe();

    this.subscriptions.set(subscriptionKey, subscription);
    return subscriptionKey;
  }

  // Unsubscribe from messages
  unsubscribeFromMessages(subscriptionKey) {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    }
  }

  // Upload image (simplified version)
  async uploadImage(userId, imageUri) {
    try {
      // For development, return a placeholder
      if (__DEV__) {
        console.log('Mock: Image upload in development mode');
        return `https://via.placeholder.com/300x200?text=Image+${Date.now()}`;
      }

      // In production, implement actual upload
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const filePath = `chat_images/${userId}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('chat_images')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat_images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // Soft delete message
  async deleteMessage(messageId, userId) {
    try {
      const { error } = await supabase
        .rpc('soft_delete_message', {
          message_id: messageId,
          user_id: userId
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  // Get unread message count
  async getUnreadCount(userId) {
    if (!userId || userId === "null") return 0;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', userId)
        .is('read_at', null)
        .is('deleted_at', null);

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Enhanced: Get messages between two users, optionally filtered by trade
  async getMessagesByUser(userId, otherUserId, tradeId = null) {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (tradeId) {
        query = query.eq('trade_id', tradeId);
      }
      const { data: messages, error } = await query;
      if (error) throw error;
      // Mark unread messages as read
      const unreadMessages = messages?.filter(msg => 
        msg.receiver_id === userId && !msg.read_at
      ) || [];
      if (unreadMessages.length > 0) {
        await this.markMessagesAsRead(unreadMessages.map(msg => msg.id));
      }
      return messages || [];
    } catch (error) {
      console.error('Error getting messages by user:', error);
      throw error;
    }
  }

  // Enhanced: Get all messages for a specific trade
  async getMessagesByTrade(tradeId) {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('trade_id', tradeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return messages || [];
    } catch (error) {
      console.error('Error getting messages by trade:', error);
      throw error;
    }
  }

  // Cleanup all subscriptions
  cleanup() {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
    this.isInitialized = false;
    console.log('Chat service cleaned up');
  }
}

export default new ChatService(); 
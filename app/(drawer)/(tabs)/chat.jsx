import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, RefreshControl } from 'react-native';
import { useAuth } from '@/Config/AuthContext';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '@/context/NotificationContext';
import ChatService from '@/app/services/chatService';

export default function ChatScreen() {
  const { user } = useAuth();
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Initialize chat service
  useEffect(() => {
    ChatService.initialize();
    return () => ChatService.cleanup();
  }, []);

  // Fetch chat users
  useEffect(() => {
    if (user) {
      fetchChatUsers();
    }
  }, [user]);

  // Handle message subscription when user is selected
  useEffect(() => {
    if (selectedUser && user) {
      fetchMessages();
      setupMessageSubscription();
    }

    return () => {
      if (subscriptionRef.current) {
        ChatService.unsubscribeFromMessages(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [selectedUser, user]);

  const { updateBadgeCounts } = useNotifications();
  const fetchChatUsers = async () => {
    try {
      setLoading(true);
      const users = await ChatService.getChatUsers(user.id);
      setChatUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load chat users');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const messageData = await ChatService.getMessages(user.id, selectedUser.id, { limit: 50 });
      setMessages(messageData);
      setHasMore(messageData.length >= 50);
      // Immediately update badge counts after marking as read
      if (typeof updateBadgeCounts === 'function') {
        updateBadgeCounts();
      }
      // Refresh chat users to update unread counts in the chat list
      fetchChatUsers();
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    try {
      setLoadingMore(true);
      const oldest = messages[0];
      const older = await ChatService.getMessages(user.id, selectedUser.id, { limit: 50, before: oldest.created_at });
      if (older.length < 50) setHasMore(false);
      setMessages(prev => [...older, ...prev]);
    } catch (e) {
      console.error('Error loading older messages:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const setupMessageSubscription = () => {
    subscriptionRef.current = ChatService.subscribeToMessages(
      user.id,
      selectedUser.id,
      handleMessageUpdate
    );
  };

  const handleMessageUpdate = (payload) => {
    if (payload.eventType === 'INSERT') {
      const newMessage = payload.new;
      if (!newMessage.deleted_at) {
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const exists = prev.some(msg => msg.id === newMessage.id);
          if (exists) return prev;
          
          const updated = [...prev, newMessage];
          // Auto-scroll to bottom for new messages
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
          return updated;
        });
      }
    } else if (payload.eventType === 'UPDATE') {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === payload.new.id ? payload.new : msg
        ).filter(msg => !msg.deleted_at)
      );
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser || sending) return;
    
    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const sent = await ChatService.sendMessage({ senderId: user.id, receiverId: selectedUser.id, content: messageContent });
      // Optimistic UI update to show the message immediately
      if (sent && sent.id) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === sent.id);
          if (exists) return prev;
          const updated = [...prev, sent];
          // scroll to bottom after state commit
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 50);
          return updated;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async () => {
    try {
      // For development, just show a mock message
      if (__DEV__) {
        Alert.alert('Image Upload', 'Image upload is available in production builds');
        return;
      }
      
      // In production, implement actual image picker
      const imageUrl = await ChatService.uploadImage(user.id, 'mock-image-uri');
      await ChatService.sendMessage({ senderId: user.id, receiverId: selectedUser.id, content: imageUrl, type: 'image' });
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await ChatService.deleteMessage(messageId, user.id);
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === user.id;
    const messageTime = new Date(item.created_at).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return (
      <TouchableOpacity
        onLongPress={() => {
          if (isMyMessage) {
            Alert.alert(
              'Delete Message',
              'Do you want to delete this message?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', onPress: () => handleDeleteMessage(item.id), style: 'destructive' }
              ]
            );
          }
        }}
        activeOpacity={0.8}
        style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage]}
      >
        <View style={[
          styles.messageContent,
          isMyMessage ? styles.myMessageContent : styles.theirMessageContent
        ]}>
          {item.type === 'image' ? (
            <>
              <Image
                source={{ uri: item.content }}
                style={styles.messageImage}
                resizeMode="cover"
              />
              <View style={styles.messageFooter}>
                <Text style={[
                  styles.messageTime,
                  isMyMessage ? styles.myMessageTime : styles.theirMessageTime
                ]}>{messageTime}</Text>
                {isMyMessage && (
                  <MaterialCommunityIcons
                    name={item.read_at ? "check-all" : "check"}
                    size={16}
                    color={item.read_at ? "#4ADE80" : "rgba(255,255,255,0.8)"}
                    style={styles.readReceipt}
                  />
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.theirMessageText
              ]}>{item.content}</Text>
              <View style={styles.messageFooter}>
                <Text style={[
                  styles.messageTime,
                  isMyMessage ? styles.myMessageTime : styles.theirMessageTime
                ]}>{messageTime}</Text>
                {isMyMessage && (
                  <MaterialCommunityIcons
                    name={item.read_at ? "check-all" : "check"}
                    size={16}
                    color={item.read_at ? "#4ADE80" : "rgba(255,255,255,0.8)"}
                    style={styles.readReceipt}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.userItem,
        item.last_message_at && styles.activeChat
      ]} 
      onPress={() => setSelectedUser(item)}
      activeOpacity={0.7}
    >
      <View style={{ position: 'relative' }}>
        <Image
          source={{ 
            uri: item.profile_image_url || 'https://via.placeholder.com/60x60?text=' + (item.name?.[0] || 'U')
          }}
          style={styles.userAvatar}
        />
        <View style={styles.onlineIndicator} />
      </View>
      <View style={styles.userInfo}>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name || item.email}</Text>
          {item.last_message_at && (
            <Text style={styles.lastMessageTime}>
              {new Date(item.last_message_at).toLocaleDateString()}
            </Text>
          )}
        </View>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unread_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!selectedUser) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#075eec', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerText}>Messages</Text>
        </LinearGradient>
        {loading ? (
          <ActivityIndicator size="large" color="#075eec" style={styles.loading} />
        ) : (
          <FlatList
            data={chatUsers}
            keyExtractor={item => item.id}
            renderItem={renderUserItem}
            contentContainerStyle={styles.userList}
            refreshing={loading}
            onRefresh={fetchChatUsers}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#3B82F6', '#2563EB', '#1D4ED8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={() => setSelectedUser(null)}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ 
                uri: selectedUser.profile_image_url || 'https://via.placeholder.com/56x56?text=' + (selectedUser.name?.[0] || 'U')
              }}
              style={styles.headerAvatar}
            />
            <View style={styles.onlineIndicator} />
          </View>
          <View>
            <Text style={styles.headerName}>
              {selectedUser.name || selectedUser.email}
            </Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={styles.loading} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          refreshControl={
            <RefreshControl refreshing={loadingMore} onRefresh={loadOlderMessages} />
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={handleImageUpload}
        >
          <Ionicons name="image" size={24} color="#2563EB" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#64748B"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity 
          style={[
            styles.sendButton, 
            (!newMessage.trim() || sending) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF4FF',
  },
  header: {
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#2563EB',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  avatarContainer: {
    position: 'relative',
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 32,
    marginRight: 16,
  },
  headerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#60A5FA',
  },
  headerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerStatus: {
    fontSize: 14,
    color: '#BFDBFE',
    marginTop: 2,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  userList: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#93C5FD',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  lastMessageTime: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  messageList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  myMessageContent: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  theirMessageContent: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#1E3A8A',
  },
  messageImage: {
    width: 250,
    height: 180,
    borderRadius: 16,
    marginBottom: 6,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    marginRight: 4,
    fontWeight: '500',
  },
  myMessageTime: {
    color: '#BFDBFE',
  },
  theirMessageTime: {
    color: '#64748B',
  },
  readReceipt: {
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  attachButton: {
    padding: 12,
    backgroundColor: '#EBF4FF',
    borderRadius: 16,
    marginRight: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#EBF4FF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: '#1E3A8A',
  },
  sendButton: {
    backgroundColor: '#2563EB',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeChat: {
    backgroundColor: '#EBF4FF',
    borderWidth: 2,
    borderColor: '#60A5FA',
  },
  onlineIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#60A5FA',
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
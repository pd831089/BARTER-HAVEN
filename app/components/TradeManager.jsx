import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';
import { useRouter } from 'expo-router';
import TradeCompletion from './TradeCompletion';
import DeliveryDetailsScreen from './DeliveryDetailsScreen';
import TradeReviewModal from './TradeReviewModal';
import ReportIssueButton from './ReportIssueButton';

export default function TradeManager({ statusFilter = null }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTradeForReview, setSelectedTradeForReview] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchTrades();
    const tradesSubscription = supabase
      .channel('trades_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trades'
      }, () => {
        fetchTrades();
      })
      .subscribe();

    return () => {
      tradesSubscription.unsubscribe();
    };
  }, []);

  const fetchTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('trades')
        .select(`
          *,
          offered_item:offered_item_id(
            id,
            title,
            image_url,
            user_id
          ),
          requested_item:requested_item_id(
            id,
            title,
            image_url,
            user_id
          ),
          proposer:proposer_id(
            id,
            name,
            profile_image_url
          ),
          receiver:receiver_id(
            id,
            name,
            profile_image_url
          ),
          trade_details(*),
          trade_reviews(*)
        `)
        .or(`proposer_id.eq.${user.id},receiver_id.eq.${user.id}`);

      // Apply status filter if provided
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
      Alert.alert('Error', 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (tradeId) => {
    try {
      const { data, error } = await supabase
        .from('trade_messages')
        .select(`
          *,
          sender:sender_id(
            id,
            name,
            profile_image_url
          )
        `)
        .eq('trade_id', tradeId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    }
  };

  const handleTradeAction = async (trade, action) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let reason = '';
      if (action === 'cancelled') {
        reason = 'Trade cancelled by user';
      } else if (action === 'rejected') {
        reason = 'Trade rejected by receiver';
      }

      const { error } = await supabase.rpc('update_trade_status', {
        p_trade_id: trade.id,
        p_new_status: action,
        p_changed_by: user.id,
        p_reason: reason
      });

      if (error) throw error;

      // Add system message about the action
      await supabase
        .from('trade_messages')
        .insert({
          trade_id: trade.id,
          sender_id: user.id,
          message: `Trade ${action}`,
          is_system_message: true
        });

      fetchTrades();
      Alert.alert('Success', `Trade ${action} successfully`);
    } catch (error) {
      console.error('Error updating trade:', error);
      Alert.alert('Error', 'Failed to update trade');
    }
  };

  const handleConfirmCompletion = async (trade) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.rpc('confirm_trade_completion', {
        p_trade_id: trade.id,
        p_user_id: user.id
      });

      if (error) throw error;

      fetchTrades();
      Alert.alert('Success', 'Trade completion confirmed');
    } catch (error) {
      console.error('Error confirming trade:', error);
      Alert.alert('Error', 'Failed to confirm trade completion');
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedTrade) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('trade_messages')
        .insert({
          trade_id: selectedTrade.id,
          sender_id: user.id,
          message: message.trim()
        });

      if (error) throw error;

      setMessage('');
      fetchMessages(selectedTrade.id);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const renderTradeActions = (item) => {
    const { data: { user } } = supabase.auth.getUser();
    const isProposer = user?.id === item.proposer_id;

    if (item.status === 'accepted') {
      return (
        <View style={styles.actionButtons}>
          {!item.trade_details && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deliveryButton]}
              onPress={() => {
                setSelectedTrade(item);
                setShowDeliveryModal(true);
              }}
            >
              <MaterialCommunityIcons name="truck-delivery" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Setup Delivery</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => {
              setSelectedTrade(item);
              setShowCompletionModal(true);
            }}
          >
            <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Complete Trade</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (item.status === 'completed') {
      const hasReviewed = item.trade_reviews?.some(review => review.reviewer_id === user?.id);
      return (
        <View style={styles.actionButtons}>
          {!hasReviewed && (
            <TouchableOpacity
              style={[styles.actionButton, styles.reviewButton]}
              onPress={() => {
                setSelectedTradeForReview(item);
                setShowReviewModal(true);
              }}
            >
              <MaterialCommunityIcons name="star" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Write Review</Text>
            </TouchableOpacity>
          )}
          <ReportIssueButton 
            trade={item} 
            onReportSubmitted={() => fetchTrades()}
          />
        </View>
      );
    }

    if (item.status === 'pending' && !isProposer) {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleTradeAction(item, 'accepted')}
          >
            <MaterialCommunityIcons name="check" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleTradeAction(item, 'rejected')}
          >
            <MaterialCommunityIcons name="close" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (item.status === 'pending' && isProposer) {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => handleTradeAction(item, 'cancelled')}
        >
          <MaterialCommunityIcons name="cancel" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Cancel</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const renderTradeItem = ({ item }) => {
    const { data: { user } } = supabase.auth.getUser();
    const isProposer = user?.id === item.proposer_id;
    const otherParty = isProposer ? item.receiver : item.proposer;

    return (
      <TouchableOpacity
        style={styles.tradeItem}
        onPress={() => {
          setSelectedTrade(item);
          fetchMessages(item.id);
          setShowTradeModal(true);
        }}
      >
        <View style={styles.tradeHeader}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: otherParty?.profile_image_url }}
              style={styles.profileImage}
              defaultSource={require('@/assets/images/placeholder.jpg')}
            />
            <Text style={styles.userName}>{otherParty?.name}</Text>
          </View>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.itemsContainer}>
          <View style={styles.itemBox}>
            <Image
              source={{ uri: item.offered_item?.image_url }}
              style={styles.itemImage}
              defaultSource={require('@/assets/images/placeholder.jpg')}
            />
            <Text style={styles.itemTitle}>{item.offered_item?.title}</Text>
          </View>

          <MaterialCommunityIcons
            name="swap-horizontal"
            size={24}
            color="#666"
            style={styles.swapIcon}
          />

          <View style={styles.itemBox}>
            <Image
              source={{ uri: item.requested_item?.image_url }}
              style={styles.itemImage}
              defaultSource={require('@/assets/images/placeholder.jpg')}
            />
            <Text style={styles.itemTitle}>{item.requested_item?.title}</Text>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <Text style={[styles.status, styles[`status${item.status}`]]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>

        <View style={styles.actionContainer}>
          {renderTradeActions(item)}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trades}
        renderItem={renderTradeItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="swap-horizontal" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No trades yet</Text>
          </View>
        }
      />

      <Modal
        visible={showTradeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trade Details</Text>
              <TouchableOpacity onPress={() => setShowTradeModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={messages}
              renderItem={({ item }) => (
                <View style={[
                  styles.messageContainer,
                  item.is_system_message ? styles.systemMessage : null
                ]}>
                  {!item.is_system_message && (
                    <Image
                      source={{ uri: item.sender.profile_image_url }}
                      style={styles.messageAvatar}
                      placeholder={item.sender.name?.[0]?.toUpperCase() || 'U'}
                    />
                  )}
                  <View style={styles.messageContent}>
                    {!item.is_system_message && (
                      <Text style={styles.messageSender}>{item.sender.name}</Text>
                    )}
                    <Text style={styles.messageText}>{item.message}</Text>
                    <Text style={styles.messageTime}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messagesContainer}
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Type a message..."
                multiline
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={sendMessage}
                disabled={!message.trim()}
              >
                <Ionicons name="send" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modals */}
      {selectedTrade && (
        <TradeCompletion
          trade={selectedTrade}
          isVisible={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
          onComplete={() => {
            setShowCompletionModal(false);
            fetchTrades();
          }}
        />
      )}

      {selectedTrade && (
        <DeliveryDetailsScreen
          trade={selectedTrade}
          isVisible={showDeliveryModal}
          onClose={() => setShowDeliveryModal(false)}
          onComplete={() => {
            setShowDeliveryModal(false);
            fetchTrades();
          }}
        />
      )}

      {selectedTradeForReview && (
        <TradeReviewModal
          trade={selectedTradeForReview}
          isVisible={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onComplete={() => {
            setShowReviewModal(false);
            fetchTrades();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
  },
  tradeItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eee',
  },
  userName: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  date: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  itemBox: {
    flex: 1,
    alignItems: 'center',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statuspending: {
    backgroundColor: '#FEF3C7',
  },
  statusaccepted: {
    backgroundColor: '#D1FAE5',
  },
  statusrejected: {
    backgroundColor: '#FEE2E2',
  },
  statuscancelled: {
    backgroundColor: '#E5E7EB',
  },
  statuscompleted: {
    backgroundColor: '#BFDBFE',
  },
  statusdisputed: {
    backgroundColor: '#FDE68A',
  },
  swapIcon: {
    marginHorizontal: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 16,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  systemMessage: {
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageContent: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#4B5563',
  },
  messageTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContainer: {
    marginTop: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  completeButton: {
    backgroundColor: '#3B82F6',
  },
  deliveryButton: {
    backgroundColor: '#3B82F6',
  },
  reviewButton: {
    backgroundColor: '#F59E0B',
  },
}); 
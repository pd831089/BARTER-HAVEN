import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';
import { useRouter } from 'expo-router';

export default function TradeHistoryList() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchUserAndTrades();
    setupRealtimeSubscription();
  }, []);

  const fetchUserAndTrades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUser(user);
      await fetchTrades(user.id);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async (userId) => {
    try {
      const { data, error } = await supabase
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
        .or(`proposer_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
      Alert.alert('Error', 'Failed to load trade history');
    }
  };

  const setupRealtimeSubscription = () => {
    const tradesSubscription = supabase
      .channel('trades_history_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trades'
      }, () => {
        if (currentUser) {
          fetchTrades(currentUser.id);
        }
      })
      .subscribe();

    return () => {
      tradesSubscription.unsubscribe();
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'accepted': return '#3B82F6';
      case 'pending': return '#F59E0B';
      case 'rejected': return '#EF4444';
      case 'cancelled': return '#6B7280';
      case 'disputed': return '#F97316';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return 'check-circle';
      case 'accepted': return 'clock-check';
      case 'pending': return 'clock';
      case 'rejected': return 'close-circle';
      case 'cancelled': return 'cancel';
      case 'disputed': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const getDeliveryMethodIcon = (method) => {
    switch (method) {
      case 'meetup': return 'map-marker-radius';
      case 'shipping': return 'truck-delivery';
      case 'digital': return 'monitor-cellphone';
      default: return 'help-circle';
    }
  };

  const renderStars = (rating, size = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={size}
          color={i <= rating ? '#FBBF24' : '#D1D5DB'}
        />
      );
    }
    return stars;
  };

  const renderTradeItem = ({ item }) => {
    const isProposer = currentUser?.id === item.proposer_id;
    const otherParty = isProposer ? item.receiver : item.proposer;
    const myItem = isProposer ? item.offered_item : item.requested_item;
    const theirItem = isProposer ? item.requested_item : item.offered_item;

    // Get reviews for this trade
    const myReview = item.trade_reviews?.find(r => r.reviewer_id === currentUser?.id);
    const theirReview = item.trade_reviews?.find(r => r.reviewed_user_id === currentUser?.id);

    return (
      <TouchableOpacity
        style={styles.tradeItem}
        onPress={() => {
          setSelectedTrade(item);
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
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{otherParty?.name}</Text>
              <Text style={styles.tradeDate}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <View style={styles.statusContainer}>
            <MaterialCommunityIcons
              name={getStatusIcon(item.status)}
              size={20}
              color={getStatusColor(item.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.itemsContainer}>
          <View style={styles.itemBox}>
            <Image
              source={{ uri: myItem?.image_url }}
              style={styles.itemImage}
              defaultSource={require('@/assets/images/placeholder.jpg')}
            />
            <Text style={styles.itemTitle}>{myItem?.title}</Text>
            <Text style={styles.itemLabel}>Your Item</Text>
          </View>

          <MaterialCommunityIcons
            name="swap-horizontal"
            size={24}
            color="#666"
            style={styles.swapIcon}
          />

          <View style={styles.itemBox}>
            <Image
              source={{ uri: theirItem?.image_url }}
              style={styles.itemImage}
              defaultSource={require('@/assets/images/placeholder.jpg')}
            />
            <Text style={styles.itemTitle}>{theirItem?.title}</Text>
            <Text style={styles.itemLabel}>Their Item</Text>
          </View>
        </View>

        {/* Delivery Method */}
        {item.trade_details && (
          <View style={styles.deliveryInfo}>
            <MaterialCommunityIcons
              name={getDeliveryMethodIcon(item.trade_details.delivery_method)}
              size={16}
              color="#6B7280"
            />
            <Text style={styles.deliveryText}>
              {item.trade_details.delivery_method.charAt(0).toUpperCase() + 
               item.trade_details.delivery_method.slice(1)}
            </Text>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.reviewsContainer}>
          {myReview && (
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Your Review:</Text>
              <View style={styles.starsContainer}>
                {renderStars(myReview.rating)}
              </View>
            </View>
          )}
          {theirReview && (
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Their Review:</Text>
              <View style={styles.starsContainer}>
                {renderStars(theirReview.rating)}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTradeDetailsModal = () => {
    if (!selectedTrade) return null;

    const isProposer = currentUser?.id === selectedTrade.proposer_id;
    const otherParty = isProposer ? selectedTrade.receiver : selectedTrade.proposer;
    const myItem = isProposer ? selectedTrade.offered_item : selectedTrade.requested_item;
    const theirItem = isProposer ? selectedTrade.requested_item : selectedTrade.offered_item;

    return (
      <Modal
        visible={showTradeModal}
        animationType="slide"
        transparent={true}
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
            
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {/* Trade Summary */}
              <View style={styles.modalTradeSummary}>
                <Text style={styles.modalSectionTitle}>Trade Summary</Text>
                <View style={styles.modalItemsContainer}>
                  <View style={styles.modalItemBox}>
                    <Image
                      source={{ uri: myItem?.image_url }}
                      style={styles.modalItemImage}
                      defaultSource={require('@/assets/images/placeholder.jpg')}
                    />
                    <Text style={styles.modalItemTitle}>{myItem?.title}</Text>
                    <Text style={styles.modalItemLabel}>Your Item</Text>
                  </View>
                  <MaterialCommunityIcons name="swap-horizontal" size={24} color="#666" />
                  <View style={styles.modalItemBox}>
                    <Image
                      source={{ uri: theirItem?.image_url }}
                      style={styles.modalItemImage}
                      defaultSource={require('@/assets/images/placeholder.jpg')}
                    />
                    <Text style={styles.modalItemTitle}>{theirItem?.title}</Text>
                    <Text style={styles.modalItemLabel}>Their Item</Text>
                  </View>
                </View>
              </View>

              {/* Delivery Details */}
              {selectedTrade.trade_details && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Delivery Details</Text>
                  <View style={styles.deliveryDetailsCard}>
                    <View style={styles.deliveryDetailRow}>
                      <MaterialCommunityIcons
                        name={getDeliveryMethodIcon(selectedTrade.trade_details.delivery_method)}
                        size={20}
                        color="#3B82F6"
                      />
                      <Text style={styles.deliveryDetailText}>
                        {selectedTrade.trade_details.delivery_method.charAt(0).toUpperCase() + 
                         selectedTrade.trade_details.delivery_method.slice(1)}
                      </Text>
                    </View>
                    
                    {selectedTrade.trade_details.meetup_location && (
                      <View style={styles.deliveryDetailRow}>
                        <MaterialCommunityIcons name="map-marker" size={20} color="#6B7280" />
                        <Text style={styles.deliveryDetailText}>
                          {selectedTrade.trade_details.meetup_location}
                        </Text>
                      </View>
                    )}
                    
                    {selectedTrade.trade_details.meetup_date_time && (
                      <View style={styles.deliveryDetailRow}>
                        <MaterialCommunityIcons name="calendar-clock" size={20} color="#6B7280" />
                        <Text style={styles.deliveryDetailText}>
                          {new Date(selectedTrade.trade_details.meetup_date_time).toLocaleString()}
                        </Text>
                      </View>
                    )}
                    
                    {selectedTrade.trade_details.shipping_address && (
                      <View style={styles.deliveryDetailRow}>
                        <MaterialCommunityIcons name="truck" size={20} color="#6B7280" />
                        <Text style={styles.deliveryDetailText}>
                          {selectedTrade.trade_details.shipping_address}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Reviews */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Reviews</Text>
                {selectedTrade.trade_reviews?.map((review) => {
                  const reviewer = review.reviewer_id === selectedTrade.proposer_id 
                    ? selectedTrade.proposer 
                    : selectedTrade.receiver;
                  const isMyReview = review.reviewer_id === currentUser?.id;
                  
                  return (
                    <View key={review.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <Image
                          source={{ uri: reviewer?.profile_image_url }}
                          style={styles.reviewerImage}
                          defaultSource={require('@/assets/images/placeholder.jpg')}
                        />
                        <View style={styles.reviewerInfo}>
                          <Text style={styles.reviewerName}>{reviewer?.name}</Text>
                          <Text style={styles.reviewDate}>
                            {new Date(review.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        {isMyReview && (
                          <View style={styles.myReviewBadge}>
                            <Text style={styles.myReviewText}>Your Review</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.reviewStars}>
                        {renderStars(review.rating, 20)}
                      </View>
                      {review.comment && (
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                      )}
                    </View>
                  );
                })}
                {(!selectedTrade.trade_reviews || selectedTrade.trade_reviews.length === 0) && (
                  <Text style={styles.noReviewsText}>No reviews yet</Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading trade history...</Text>
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
            <MaterialCommunityIcons name="history" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Trade History</Text>
            <Text style={styles.emptyDescription}>
              Your completed trades will appear here
            </Text>
          </View>
        }
      />
      {renderTradeDetailsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
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
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  tradeDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  itemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemBox: {
    flex: 1,
    alignItems: 'center',
  },
  itemImage: {
    width: 60,
    height: 60,
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
  itemLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  swapIcon: {
    marginHorizontal: 16,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  deliveryText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  reviewsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  reviewLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalScrollContent: {
    padding: 20,
  },
  modalTradeSummary: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  modalItemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalItemBox: {
    flex: 1,
    alignItems: 'center',
  },
  modalItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalItemLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalSection: {
    marginBottom: 24,
  },
  deliveryDetailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  deliveryDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deliveryDetailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  reviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  myReviewBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  myReviewText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  reviewStars: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noReviewsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 
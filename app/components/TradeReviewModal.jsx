import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';

export default function TradeReviewModal({ trade, isVisible, onClose, onComplete }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [otherParty, setOtherParty] = useState(null);
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    if (isVisible && trade) {
      fetchUserInfo();
      fetchExistingReview();
    }
  }, [isVisible, trade]);

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUser(user);
      
      // Determine the other party
      const isProposer = user.id === trade.proposer_id;
      const otherPartyId = isProposer ? trade.receiver_id : trade.proposer_id;
      const otherPartyData = isProposer ? trade.receiver : trade.proposer;
      
      setOtherParty({
        id: otherPartyId,
        name: otherPartyData?.name || 'Unknown User',
        profile_image_url: otherPartyData?.profile_image_url
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const fetchExistingReview = async () => {
    if (!currentUser || !trade) return;

    try {
      const { data, error } = await supabase
        .from('trade_reviews')
        .select('*')
        .eq('trade_id', trade.id)
        .eq('reviewer_id', currentUser.id)
        .eq('reviewed_user_id', otherParty?.id)
        .single();

      if (!error && data) {
        setExistingReview(data);
        setRating(data.rating);
        setComment(data.comment || '');
      }
    } catch (error) {
      console.error('Error fetching existing review:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    if (!currentUser || !otherParty) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('submit_trade_review', {
        p_trade_id: trade.id,
        p_reviewer_id: currentUser.id,
        p_reviewed_user_id: otherParty.id,
        p_rating: rating,
        p_comment: comment.trim() || null
      });

      if (error) throw error;

      Alert.alert(
        'Success', 
        existingReview ? 'Review updated successfully!' : 'Review submitted successfully!'
      );
      onComplete();
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setRating(i)}
          style={styles.starButton}
        >
          <Ionicons
            name={i <= rating ? 'star' : 'star-outline'}
            size={32}
            color={i <= rating ? '#FBBF24' : '#D1D5DB'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const getRatingDescription = () => {
    switch (rating) {
      case 1: return 'Poor - Very dissatisfied with the trade';
      case 2: return 'Fair - Somewhat dissatisfied with the trade';
      case 3: return 'Good - Satisfied with the trade';
      case 4: return 'Very Good - Very satisfied with the trade';
      case 5: return 'Excellent - Extremely satisfied with the trade';
      default: return 'Select a rating to describe your experience';
    }
  };

  const renderTradeSummary = () => (
    <View style={styles.tradeSummary}>
      <Text style={styles.summaryTitle}>Trade Summary</Text>
      <View style={styles.itemsContainer}>
        <View style={styles.itemBox}>
          <Image
            source={{ uri: trade.offered_item?.image_url }}
            style={styles.itemImage}
            defaultSource={require('@/assets/images/placeholder.jpg')}
          />
          <Text style={styles.itemTitle}>{trade.offered_item?.title}</Text>
          <Text style={styles.itemSubtitle}>Offered by {trade.proposer?.name}</Text>
        </View>
        <MaterialCommunityIcons name="swap-horizontal" size={24} color="#666" />
        <View style={styles.itemBox}>
          <Image
            source={{ uri: trade.requested_item?.image_url }}
            style={styles.itemImage}
            defaultSource={require('@/assets/images/placeholder.jpg')}
          />
          <Text style={styles.itemTitle}>{trade.requested_item?.title}</Text>
          <Text style={styles.itemSubtitle}>Offered by {trade.receiver?.name}</Text>
        </View>
      </View>
    </View>
  );

  const renderOtherPartyInfo = () => (
    <View style={styles.otherPartySection}>
      <Text style={styles.sectionTitle}>Review for {otherParty?.name}</Text>
      <View style={styles.otherPartyCard}>
        <Image
          source={{ uri: otherParty?.profile_image_url }}
          style={styles.otherPartyImage}
          defaultSource={require('@/assets/images/placeholder.jpg')}
        />
        <View style={styles.otherPartyInfo}>
          <Text style={styles.otherPartyName}>{otherParty?.name}</Text>
          <Text style={styles.otherPartyRole}>
            {currentUser?.id === trade.proposer_id ? 'Receiver' : 'Proposer'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {existingReview ? 'Update Review' : 'Write Review'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {renderTradeSummary()}
            {renderOtherPartyInfo()}

            {/* Rating Section */}
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>Your Rating</Text>
              <View style={styles.starsContainer}>
                {renderStars()}
              </View>
              <Text style={styles.ratingDescription}>
                {getRatingDescription()}
              </Text>
            </View>

            {/* Comment Section */}
            <View style={styles.commentSection}>
              <Text style={styles.sectionTitle}>Your Review (Optional)</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Share your experience with this trade..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={styles.characterCount}>
                {comment.length}/500 characters
              </Text>
            </View>

            {/* Review Guidelines */}
            <View style={styles.guidelinesSection}>
              <Text style={styles.guidelinesTitle}>Review Guidelines</Text>
              <View style={styles.guidelineItem}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
                <Text style={styles.guidelineText}>Be honest and constructive</Text>
              </View>
              <View style={styles.guidelineItem}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
                <Text style={styles.guidelineText}>Focus on the trade experience</Text>
              </View>
              <View style={styles.guidelineItem}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />
                <Text style={styles.guidelineText}>Avoid personal attacks</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmitReview}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {existingReview ? 'Update Review' : 'Submit Review'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollContent: {
    flexGrow: 1,
  },
  tradeSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  itemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  itemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  otherPartySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  otherPartyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  otherPartyImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  otherPartyInfo: {
    flex: 1,
  },
  otherPartyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  otherPartyRole: {
    fontSize: 14,
    color: '#6B7280',
  },
  ratingSection: {
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  starButton: {
    marginHorizontal: 4,
  },
  ratingDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  commentSection: {
    marginBottom: 24,
  },
  commentInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  guidelinesSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  guidelineText: {
    fontSize: 14,
    color: '#1E40AF',
    marginLeft: 8,
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
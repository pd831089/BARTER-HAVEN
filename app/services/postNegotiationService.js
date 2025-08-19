import { supabase } from '@/Config/supabaseConfig';

class PostNegotiationService {
  // Delivery Details Management
  async createDeliveryDetails(tradeId, deliveryData) {
    try {
      const { data, error } = await supabase.rpc('create_trade_details', {
        p_trade_id: tradeId,
        p_delivery_method: deliveryData.method,
        p_meetup_location: deliveryData.meetupLocation || null,
        p_meetup_date_time: deliveryData.meetupDateTime || null,
        p_shipping_address: deliveryData.shippingAddress || null,
        p_tracking_number: deliveryData.trackingNumber || null,
        p_contact_info: deliveryData.contactInfo || null,
        p_delivery_notes: deliveryData.notes || null
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating delivery details:', error);
      throw error;
    }
  }

  async getDeliveryDetails(tradeId) {
    try {
      const { data, error } = await supabase
        .from('trade_details')
        .select('*')
        .eq('trade_id', tradeId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching delivery details:', error);
      throw error;
    }
  }

  async updateDeliveryDetails(tradeId, updates) {
    try {
      const { data, error } = await supabase
        .from('trade_details')
        .update(updates)
        .eq('trade_id', tradeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating delivery details:', error);
      throw error;
    }
  }

  // Trade Reviews Management
  async submitTradeReview(tradeId, reviewerId, reviewedUserId, rating, comment) {
    try {
      const { data, error } = await supabase.rpc('submit_trade_review', {
        p_trade_id: tradeId,
        p_reviewer_id: reviewerId,
        p_reviewed_user_id: reviewedUserId,
        p_rating: rating,
        p_comment: comment
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error submitting trade review:', error);
      throw error;
    }
  }

  async getTradeReviews(tradeId) {
    try {
      const { data, error } = await supabase
        .from('trade_reviews')
        .select(`
          *,
          reviewer:reviewer_id(
            id,
            name,
            profile_image_url
          ),
          reviewed_user:reviewed_user_id(
            id,
            name,
            profile_image_url
          )
        `)
        .eq('trade_id', tradeId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching trade reviews:', error);
      throw error;
    }
  }

  async getUserReviews(userId) {
    try {
      const { data, error } = await supabase
        .from('trade_reviews')
        .select(`
          *,
          trade:trade_id(
            id,
            offered_item:offered_item_id(title, image_url),
            requested_item:requested_item_id(title, image_url)
          ),
          reviewer:reviewer_id(
            id,
            name,
            profile_image_url
          ),
          reviewed_user:reviewed_user_id(
            id,
            name,
            profile_image_url
          )
        `)
        .or(`reviewer_id.eq.${userId},reviewed_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      throw error;
    }
  }

  // Dispute Management
  async reportDispute(tradeId, reportedBy, reason, description, evidenceUrls) {
    try {
      const { data, error } = await supabase.rpc('report_trade_dispute', {
        p_trade_id: tradeId,
        p_reported_by: reportedBy,
        p_reason: reason,
        p_description: description,
        p_evidence_urls: evidenceUrls
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error reporting dispute:', error);
      throw error;
    }
  }

  async getTradeDisputes(tradeId) {
    try {
      const { data, error } = await supabase
        .from('trade_disputes')
        .select(`
          *,
          reported_by_user:reported_by(
            id,
            name,
            profile_image_url
          ),
          resolved_by_user:resolved_by(
            id,
            name
          )
        `)
        .eq('trade_id', tradeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching trade disputes:', error);
      throw error;
    }
  }

  async getUserDisputes(userId) {
    try {
      const { data, error } = await supabase
        .from('trade_disputes')
        .select(`
          *,
          trade:trade_id(
            id,
            offered_item:offered_item_id(title, image_url),
            requested_item:requested_item_id(title, image_url),
            proposer:proposer_id(name),
            receiver:receiver_id(name)
          )
        `)
        .eq('reported_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user disputes:', error);
      throw error;
    }
  }

  // Trade Completion Summary
  async getTradeCompletionSummary(tradeId) {
    try {
      const { data, error } = await supabase.rpc('get_trade_completion_summary', {
        p_trade_id: tradeId
      });

      if (error) throw error;
      return data[0]; // Function returns a table, so we get the first row
    } catch (error) {
      console.error('Error fetching trade completion summary:', error);
      throw error;
    }
  }

  // Enhanced Trade History
  async getTradeHistory(userId, filters = {}) {
    try {
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
          trade_reviews(*),
          trade_disputes(*)
        `)
        .or(`proposer_id.eq.${userId},receiver_id.eq.${userId}`);

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching trade history:', error);
      throw error;
    }
  }

  // Real-time subscriptions
  subscribeToTradeUpdates(tradeId, callback) {
    return supabase
      .channel(`trade_${tradeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trades',
        filter: `id=eq.${tradeId}`
      }, callback)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_details',
        filter: `trade_id=eq.${tradeId}`
      }, callback)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_reviews',
        filter: `trade_id=eq.${tradeId}`
      }, callback)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trade_disputes',
        filter: `trade_id=eq.${tradeId}`
      }, callback)
      .subscribe();
  }

  // Notification helpers
  async sendTradeNotification(tradeId, type, message) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get trade participants
      const { data: trade } = await supabase
        .from('trades')
        .select('proposer_id, receiver_id')
        .eq('id', tradeId)
        .single();

      if (!trade) return;

      const recipients = [trade.proposer_id, trade.receiver_id].filter(id => id !== user.id);

      // Create notifications for recipients
      const notifications = recipients.map(recipientId => ({
        user_id: recipientId,
        type: type,
        title: 'Trade Update',
        body: message,
        data: { trade_id: tradeId }
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) throw error;
    } catch (error) {
      console.error('Error sending trade notification:', error);
    }
  }

  // Analytics helpers
  async getTradeStats(userId) {
    try {
      const { data: trades } = await supabase
        .from('trades')
        .select('status, created_at')
        .or(`proposer_id.eq.${userId},receiver_id.eq.${userId}`);

      if (!trades) return {};

      const stats = {
        total: trades.length,
        completed: trades.filter(t => t.status === 'completed').length,
        pending: trades.filter(t => t.status === 'pending').length,
        disputed: trades.filter(t => t.status === 'disputed').length,
        averageCompletionTime: 0
      };

      // Calculate average completion time
      const completedTrades = trades.filter(t => t.status === 'completed');
      if (completedTrades.length > 0) {
        const totalTime = completedTrades.reduce((sum, trade) => {
          const created = new Date(trade.created_at);
          const completed = new Date(trade.updated_at);
          return sum + (completed - created);
        }, 0);
        stats.averageCompletionTime = totalTime / completedTrades.length;
      }

      return stats;
    } catch (error) {
      console.error('Error fetching trade stats:', error);
      return {};
    }
  }
}

export default new PostNegotiationService(); 
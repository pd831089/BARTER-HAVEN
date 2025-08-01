import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';

export default function ReportIssueButton({ trade, onReportSubmitted }) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');

  const disputeReasons = [
    {
      id: 'item_not_as_described',
      title: 'Item not as described',
      description: 'The item received doesn\'t match the description',
      icon: 'package-variant-closed'
    },
    {
      id: 'item_damaged',
      title: 'Item damaged',
      description: 'The item arrived damaged or in poor condition',
      icon: 'package-variant-remove'
    },
    {
      id: 'no_communication',
      title: 'No communication',
      description: 'The other party stopped responding',
      icon: 'message-off'
    },
    {
      id: 'no_show',
      title: 'No show',
      description: 'The other party didn\'t show up for meetup',
      icon: 'account-off'
    },
    {
      id: 'shipping_issues',
      title: 'Shipping issues',
      description: 'Problems with shipping or delivery',
      icon: 'truck-delivery-outline'
    },
    {
      id: 'fraud',
      title: 'Suspected fraud',
      description: 'Suspicious or fraudulent behavior',
      icon: 'shield-alert'
    },
    {
      id: 'other',
      title: 'Other',
      description: 'Other issues not listed above',
      icon: 'help-circle'
    }
  ];

  const handleReportIssue = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for the dispute');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description of the issue');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('report_trade_dispute', {
        p_trade_id: trade.id,
        p_reported_by: user.id,
        p_reason: selectedReason,
        p_description: description.trim()
      });

      if (error) throw error;

      Alert.alert(
        'Dispute Reported',
        'Your dispute has been reported. Our team will review it and contact you soon.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowModal(false);
              setReason('');
              setDescription('');
              setSelectedReason('');
              if (onReportSubmitted) {
                onReportSubmitted();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error reporting dispute:', error);
      Alert.alert('Error', 'Failed to report dispute. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderReasonOption = (reasonOption) => (
    <TouchableOpacity
      key={reasonOption.id}
      style={[
        styles.reasonOption,
        selectedReason === reasonOption.id && styles.reasonOptionSelected
      ]}
      onPress={() => setSelectedReason(reasonOption.id)}
    >
      <View style={styles.reasonHeader}>
        <MaterialCommunityIcons
          name={reasonOption.icon}
          size={24}
          color={selectedReason === reasonOption.id ? '#3B82F6' : '#6B7280'}
        />
        <View style={styles.reasonTextContainer}>
          <Text style={[
            styles.reasonTitle,
            selectedReason === reasonOption.id && styles.reasonTitleSelected
          ]}>
            {reasonOption.title}
          </Text>
          <Text style={styles.reasonDescription}>
            {reasonOption.description}
          </Text>
        </View>
        {selectedReason === reasonOption.id && (
          <MaterialCommunityIcons
            name="check-circle"
            size={24}
            color="#3B82F6"
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setShowModal(true)}
      >
        <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
        <Text style={styles.reportButtonText}>Report Issue</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Trade Issue</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Trade Summary */}
              <View style={styles.tradeSummary}>
                <Text style={styles.summaryTitle}>Trade Summary</Text>
                <View style={styles.itemsContainer}>
                  <View style={styles.itemBox}>
                    <Text style={styles.itemTitle}>{trade.offered_item?.title}</Text>
                    <Text style={styles.itemLabel}>Offered Item</Text>
                  </View>
                  <MaterialCommunityIcons name="swap-horizontal" size={20} color="#666" />
                  <View style={styles.itemBox}>
                    <Text style={styles.itemTitle}>{trade.requested_item?.title}</Text>
                    <Text style={styles.itemLabel}>Requested Item</Text>
                  </View>
                </View>
              </View>

              {/* Reason Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What's the issue?</Text>
                <Text style={styles.sectionDescription}>
                  Please select the reason that best describes the problem you're experiencing.
                </Text>
                {disputeReasons.map(renderReasonOption)}
              </View>

              {/* Description */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Details</Text>
                <Text style={styles.sectionDescription}>
                  Please provide more details about the issue to help us resolve it quickly.
                </Text>
                <TextInput
                  style={styles.descriptionInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe what happened and any relevant details..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={6}
                  maxLength={1000}
                />
                <Text style={styles.characterCount}>
                  {description.length}/1000 characters
                </Text>
              </View>

              {/* Guidelines */}
              <View style={styles.guidelinesSection}>
                <Text style={styles.guidelinesTitle}>What happens next?</Text>
                <View style={styles.guidelineItem}>
                  <MaterialCommunityIcons name="clock" size={16} color="#3B82F6" />
                  <Text style={styles.guidelineText}>
                    Our team will review your report within 24-48 hours
                  </Text>
                </View>
                <View style={styles.guidelineItem}>
                  <MaterialCommunityIcons name="message-text" size={16} color="#3B82F6" />
                  <Text style={styles.guidelineText}>
                    We'll contact you via email or in-app notification
                  </Text>
                </View>
                <View style={styles.guidelineItem}>
                  <MaterialCommunityIcons name="shield-check" size={16} color="#3B82F6" />
                  <Text style={styles.guidelineText}>
                    Your information is kept confidential and secure
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleReportIssue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  reportButton: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  reportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
    marginBottom: 24,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  reasonOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  reasonTitleSelected: {
    color: '#3B82F6',
  },
  reasonDescription: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  descriptionInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 120,
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
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#EF4444',
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
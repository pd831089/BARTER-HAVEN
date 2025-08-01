import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';
import QRCode from 'react-native-qrcode-svg';

export default function TradeCompletion({ trade, isVisible, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [proposerConfirmed, setProposerConfirmed] = useState(false);
  const [receiverConfirmed, setReceiverConfirmed] = useState(false);
  const [showNextStep, setShowNextStep] = useState(false);
  let user;
  try {
    const { data } = supabase.auth.getUser();
    user = data?.user;
  } catch (e) {
    user = undefined;
  }

  if (!user) {
    return (
      <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Not Logged In</Text>
            <Text style={{ fontSize: 16, color: '#666' }}>Please log in to complete this trade.</Text>
            <TouchableOpacity onPress={onClose} style={{ marginTop: 16, alignSelf: 'flex-end' }}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const isProposer = user?.id === trade?.proposer_id;
  const otherParty = isProposer ? trade?.receiver : trade?.proposer;

  const handleConfirmStep = async () => {
    try {
      const { error } = await supabase.rpc('confirm_trade_completion', {
        p_trade_id: trade.id,
        p_user_id: user.id
      });

      if (error) throw error;

      if (isProposer) {
        setProposerConfirmed(true);
      } else {
        setReceiverConfirmed(true);
      }

      // Move to next step
      setStep(step + 1);

      // Check if both parties have confirmed
      if (trade.proposer_confirmed || trade.receiver_confirmed) {
        setShowNextStep(true);
        onComplete();
        Alert.alert('Success', 'Trade completed successfully!');
        onClose();
      }
    } catch (error) {
      console.error('Error confirming trade:', error);
      Alert.alert('Error', 'Failed to confirm trade completion');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <MaterialCommunityIcons name="handshake" size={60} color="#3B82F6" />
            <Text style={styles.stepTitle}>Verify Trade Details</Text>
            <Text style={styles.stepDescription}>
              Please verify that you have received the item as described and are satisfied with the trade.
            </Text>
            <View style={styles.tradeDetails}>
              <View style={styles.itemBox}>
                <Image
                  source={{ uri: trade.offered_item?.image_url }}
                  style={styles.itemImage}
                  defaultSource={require('@/assets/images/placeholder.jpg')}
                />
                <Text style={styles.itemTitle}>{trade.offered_item?.title}</Text>
                <Text style={styles.itemSubtitle}>Offered by {trade.proposer?.name}</Text>
              </View>
              <MaterialCommunityIcons name="swap-horizontal" size={24} color="#666" style={styles.swapIcon} />
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
      case 2:
        return (
          <View style={styles.stepContainer}>
            <MaterialCommunityIcons name="check-circle" size={60} color="#10B981" />
            <Text style={styles.stepTitle}>Confirm Receipt</Text>
            <Text style={styles.stepDescription}>
              By confirming, you acknowledge that you have received the item and are satisfied with the trade.
            </Text>
            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="alert" size={24} color="#F59E0B" />
              <Text style={styles.warningText}>
                This action cannot be undone. If you have any issues, please report them before confirming.
              </Text>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <MaterialCommunityIcons name="clock-check" size={60} color="#8B5CF6" />
            <Text style={styles.stepTitle}>Waiting for Other Party</Text>
            <Text style={styles.stepDescription}>
              {`Waiting for ${otherParty?.name} to confirm the trade completion.`}
            </Text>
            <View style={styles.statusBox}>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name={proposerConfirmed ? "check-circle" : "clock"}
                  size={24}
                  color={proposerConfirmed ? "#10B981" : "#6B7280"}
                />
                <Text style={styles.statusText}>{trade.proposer?.name}</Text>
              </View>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name={receiverConfirmed ? "check-circle" : "clock"}
                  size={24}
                  color={receiverConfirmed ? "#10B981" : "#6B7280"}
                />
                <Text style={styles.statusText}>{trade.receiver?.name}</Text>
              </View>
            </View>
          </View>
        );
    }
  };

  const renderNextStep = () => {
    if (!trade.exchange_mode || trade.exchange_mode === 'online') {
      return (
        <View style={styles.nextStepContainer}>
          <MaterialCommunityIcons name="chat" size={48} color="#3B82F6" />
          <Text style={styles.nextStepTitle}>Continue in Chat</Text>
          <Text style={styles.nextStepDescription}>You can now chat with the other party to finalize the online barter or share digital confirmation.</Text>
        </View>
      );
    } else if (trade.exchange_mode === 'in_person') {
      return (
        <View style={styles.nextStepContainer}>
          <MaterialCommunityIcons name="map-marker-radius" size={48} color="#10B981" />
          <Text style={styles.nextStepTitle}>Meet In Person</Text>
          <Text style={styles.nextStepDescription}>Coordinate a location to meet and complete the barter. Show this QR code to confirm your meeting.</Text>
          <View style={{ marginVertical: 16 }}>
            <QRCode value={`barterhaven:trade:${trade.id}`} size={160} />
          </View>
        </View>
      );
    }
    return null;
  };

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
            <Text style={styles.modalTitle}>Complete Trade</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {showNextStep ? renderNextStep() : renderStep()}
          </ScrollView>

          <View style={styles.footer}>
            {step < 3 && !showNextStep && (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleConfirmStep}
              >
                <Text style={styles.nextButtonText}>
                  {step === 1 ? 'Continue' : 'Confirm Completion'}
                </Text>
              </TouchableOpacity>
            )}
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
    minHeight: '80%',
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
  stepContainer: {
    alignItems: 'center',
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 10,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  tradeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  itemBox: {
    flex: 1,
    alignItems: 'center',
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  swapIcon: {
    marginHorizontal: 10,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  warningText: {
    flex: 1,
    marginLeft: 10,
    color: '#92400E',
    fontSize: 14,
  },
  statusBox: {
    width: '100%',
    marginTop: 20,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 10,
  },
  statusText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#3B82F6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextStepContainer: {
    alignItems: 'center',
    padding: 20,
  },
  nextStepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 10,
  },
  nextStepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
}); 
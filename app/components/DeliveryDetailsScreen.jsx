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
import mapService from '@/app/services/mapService';
// import * as Location from 'expo-location'; // Removed for Expo Go compatibility
import MapPicker from './MapPicker';

export default function DeliveryDetailsScreen({ trade, isVisible, onClose, onComplete }) {
  if (!trade) {
    return null;
  }
  const [deliveryMethod, setDeliveryMethod] = useState('meetup');
  const [meetupLocation, setMeetupLocation] = useState('');
  const [meetupDateTime, setMeetupDateTime] = useState(new Date());
  const [shippingAddress, setShippingAddress] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [contactInfo, setContactInfo] = useState({
    phone: '',
    email: '',
    preferredContact: 'phone'
  });
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [meetupCoords, setMeetupCoords] = useState(null);

  useEffect(() => {
    if (isVisible) {
      fetchUserLocation();
    }
  }, [isVisible]);

  const fetchUserLocation = async () => {
    try {
      // For Expo Go compatibility, we'll skip location fetching
      // In a custom dev build, you can uncomment the location code below
      /*
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation(location);
      }
      */
      console.log('Location feature disabled for Expo Go compatibility');
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const handleSaveDeliveryDetails = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save map coordinates if selected
      if (meetupCoords) {
        try {
          // Get address from coordinates
          const address = await mapService.reverseGeocode(meetupCoords.latitude, meetupCoords.longitude);
          
          // Save location data to trade_details table
          await mapService.saveLocation('trade_details', trade.id, {
            latitude: meetupCoords.latitude,
            longitude: meetupCoords.longitude,
            address: address
          });
        } catch (locationError) {
          console.warn('Could not save location data:', locationError);
          // Continue with trade details even if location save fails
        }
      }

      const { error } = await supabase.rpc('create_trade_details', {
        p_trade_id: trade.id,
        p_delivery_method: deliveryMethod,
        p_meetup_location: deliveryMethod === 'meetup' ? meetupLocation : null,
        p_meetup_date_time: deliveryMethod === 'meetup' ? meetupDateTime.toISOString() : null,
        p_shipping_address: deliveryMethod === 'shipping' ? shippingAddress : null,
        p_tracking_number: deliveryMethod === 'shipping' ? trackingNumber : null,
        p_contact_info: contactInfo,
        p_delivery_notes: deliveryNotes
      });

      if (error) throw error;

      Alert.alert('Success', 'Delivery details saved successfully!');
      onComplete();
      onClose();
    } catch (error) {
      console.error('Error saving delivery details:', error);
      Alert.alert('Error', 'Failed to save delivery details');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (deliveryMethod === 'meetup' && !meetupLocation.trim()) {
      Alert.alert('Error', 'Please enter a meetup location');
      return false;
    }
    if (deliveryMethod === 'shipping' && !shippingAddress.trim()) {
      Alert.alert('Error', 'Please enter a shipping address');
      return false;
    }
    if (!contactInfo.phone.trim() && !contactInfo.email.trim()) {
      Alert.alert('Error', 'Please provide at least one contact method');
      return false;
    }
    return true;
  };

  const renderDeliveryMethodOption = (method, title, icon, description) => (
    <TouchableOpacity
      style={[
        styles.methodOption,
        deliveryMethod === method && styles.methodOptionSelected
      ]}
      onPress={() => setDeliveryMethod(method)}
    >
      <View style={styles.methodHeader}>
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color={deliveryMethod === method ? '#3B82F6' : '#6B7280'}
        />
        <Text style={[
          styles.methodTitle,
          deliveryMethod === method && styles.methodTitleSelected
        ]}>
          {title}
        </Text>
      </View>
      <Text style={styles.methodDescription}>{description}</Text>
    </TouchableOpacity>
  );

  const renderMeetupForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Meetup Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={meetupLocation}
          onChangeText={setMeetupLocation}
          placeholder="Enter meetup location (e.g., Coffee shop, Park) or pick on map"
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={styles.mapButton} onPress={() => setShowMapPicker(true)}>
          <Ionicons name="map" size={20} color="#075eec" />
          <Text style={styles.mapButtonText}>Pick on Map</Text>
        </TouchableOpacity>
        {meetupCoords && (
          <Text style={styles.coordPreview}>
            Selected: Lat {meetupCoords.latitude.toFixed(6)}, Lng {meetupCoords.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Date & Time</Text>
        <TextInput
          style={styles.input}
          value={meetupDateTime.toLocaleString()}
          onChangeText={text => {
            // Try to parse the date/time string
            const parsed = new Date(text);
            if (!isNaN(parsed)) {
              setMeetupDateTime(parsed);
            }
          }}
          placeholder="Enter date and time (e.g. 2025-07-10 14:30)"
          placeholderTextColor="#9CA3AF"
        />
      </View>
      {/* MapPicker Modal */}
      <Modal visible={showMapPicker} animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <MapPicker
            initialLocation={meetupCoords}
            onLocationSelected={coords => {
              setMeetupCoords(coords);
              setMeetupLocation(`Lat: ${coords.latitude.toFixed(6)}, Lng: ${coords.longitude.toFixed(6)}`);
              setShowMapPicker(false);
            }}
            onCancel={() => setShowMapPicker(false)}
            confirmLabel="Confirm Location"
          />
        </View>
      </Modal>
    </View>
  );

  const renderShippingForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Shipping Details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Shipping Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={shippingAddress}
          onChangeText={setShippingAddress}
          placeholder="Enter complete shipping address"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tracking Number (Optional)</Text>
        <TextInput
          style={styles.input}
          value={trackingNumber}
          onChangeText={setTrackingNumber}
          placeholder="Enter tracking number when available"
          placeholderTextColor="#9CA3AF"
        />
      </View>
    </View>
  );

  const renderDigitalForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Digital Exchange</Text>
      <Text style={styles.digitalDescription}>
        For digital services or items, coordinate the exchange through the chat feature.
        Make sure to confirm receipt and satisfaction before marking the trade as complete.
      </Text>
    </View>
  );

  const renderContactForm = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Contact Information</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={contactInfo.phone}
          onChangeText={(text) => setContactInfo({ ...contactInfo, phone: text })}
          placeholder="Enter your phone number"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={contactInfo.email}
          onChangeText={(text) => setContactInfo({ ...contactInfo, email: text })}
          placeholder="Enter your email address"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Preferred Contact Method</Text>
        <View style={styles.contactMethodButtons}>
          <TouchableOpacity
            style={[
              styles.contactMethodButton,
              contactInfo.preferredContact === 'phone' && styles.contactMethodButtonSelected
            ]}
            onPress={() => setContactInfo({ ...contactInfo, preferredContact: 'phone' })}
          >
            <MaterialCommunityIcons
              name="phone"
              size={20}
              color={contactInfo.preferredContact === 'phone' ? '#fff' : '#6B7280'}
            />
            <Text style={[
              styles.contactMethodText,
              contactInfo.preferredContact === 'phone' && styles.contactMethodTextSelected
            ]}>
              Phone
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.contactMethodButton,
              contactInfo.preferredContact === 'email' && styles.contactMethodButtonSelected
            ]}
            onPress={() => setContactInfo({ ...contactInfo, preferredContact: 'email' })}
          >
            <MaterialCommunityIcons
              name="email"
              size={20}
              color={contactInfo.preferredContact === 'email' ? '#fff' : '#6B7280'}
            />
            <Text style={[
              styles.contactMethodText,
              contactInfo.preferredContact === 'email' && styles.contactMethodTextSelected
            ]}>
              Email
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.modalTitle}>Delivery Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Trade Summary */}
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
                </View>
                <MaterialCommunityIcons name="swap-horizontal" size={24} color="#666" />
                <View style={styles.itemBox}>
                  <Image
                    source={{ uri: trade.requested_item?.image_url }}
                    style={styles.itemImage}
                    defaultSource={require('@/assets/images/placeholder.jpg')}
                  />
                  <Text style={styles.itemTitle}>{trade.requested_item?.title}</Text>
                </View>
              </View>
            </View>

            {/* Delivery Method Selection */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Delivery Method</Text>
              {renderDeliveryMethodOption(
                'meetup',
                'Meet in Person',
                'map-marker-radius',
                'Meet at a public location to exchange items'
              )}
              {renderDeliveryMethodOption(
                'shipping',
                'Ship Items',
                'truck-delivery',
                'Ship items to each other via mail/courier'
              )}
              {renderDeliveryMethodOption(
                'digital',
                'Digital Exchange',
                'monitor-cellphone',
                'Exchange digital services or items online'
              )}
            </View>

            {/* Conditional Forms */}
            {deliveryMethod === 'meetup' && renderMeetupForm()}
            {deliveryMethod === 'shipping' && renderShippingForm()}
            {deliveryMethod === 'digital' && renderDigitalForm()}

            {/* Contact Information */}
            {renderContactForm()}

            {/* Delivery Notes */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Additional Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
                placeholder="Any additional notes about the delivery..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSaveDeliveryDetails}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Delivery Details</Text>
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
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  methodOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodOptionSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 12,
  },
  methodTitleSelected: {
    color: '#3B82F6',
  },
  methodDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 36,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  digitalDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  contactMethodButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactMethodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactMethodButtonSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  contactMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
  },
  contactMethodTextSelected: {
    color: '#fff',
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#eaf1ff',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  mapButtonText: {
    color: '#075eec',
    fontSize: 15,
    marginLeft: 6,
    fontFamily: 'outfit',
  },
  coordPreview: {
    marginTop: 6,
    color: '#075eec',
    fontSize: 14,
    fontFamily: 'outfit',
  },
}); 
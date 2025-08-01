import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapService from '@/app/services/mapService';
import SimpleMap from './SimpleMap';

// Check if maps are available
let isMapsAvailable = false;
try {
  require('react-native-maps');
  isMapsAvailable = true;
} catch (error) {
  isMapsAvailable = false;
}

export default function LocationPicker({
  onLocationSelect,
  initialLocation = null,
  style,
  placeholder = "Enter address manually...",
}) {
  const [location, setLocation] = useState(initialLocation);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualEdit, setManualEdit] = useState(false);

  useEffect(() => {
    if (initialLocation?.address?.fullAddress) {
      setAddress(initialLocation.address.fullAddress);
    }
  }, [initialLocation]);

  const handleUseMyLocation = async () => {
    try {
      setLoading(true);
      const locationData = await MapService.getLocationWithAddress();
      
      setLocation(locationData);
      setAddress(locationData.address?.fullAddress || '');
      setManualEdit(false);
      
      if (onLocationSelect) {
        onLocationSelect(locationData);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        'Failed to get your current location. You can enter your address manually.',
        [
          { text: 'OK' },
          { text: 'Enter Manually', onPress: () => setManualEdit(true) }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddressChange = (text) => {
    setAddress(text);
    if (manualEdit && onLocationSelect) {
      // Create a location object with just the address for manual entry
      const manualLocation = {
        latitude: null,
        longitude: null,
        address: {
          street: '',
          city: '',
          region: '',
          postalCode: '',
          country: '',
          fullAddress: text,
        },
        isManualEntry: true,
      };
      onLocationSelect(manualLocation);
    }
  };

  const handleForwardGeocode = async () => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address first');
      return;
    }

    try {
      setLoading(true);
      const coordinates = await MapService.forwardGeocode(address);
      
      const locationData = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address: {
          fullAddress: address,
        },
      };
      
      setLocation(locationData);
      setManualEdit(false);
      
      if (onLocationSelect) {
        onLocationSelect(locationData);
      }
      
      Alert.alert('Success', 'Address converted to coordinates successfully');
    } catch (error) {
      console.error('Error forward geocoding:', error);
      Alert.alert('Error', 'Could not convert address to coordinates. Please try a different address.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (selectedLocation) => {
    setLocation(selectedLocation);
    setAddress(selectedLocation.address?.fullAddress || '');
    setManualEdit(false);
    
    if (onLocationSelect) {
      onLocationSelect(selectedLocation);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.locationButtonContainer}>
        <TouchableOpacity
          style={styles.useLocationButton}
          onPress={handleUseMyLocation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="location" size={20} color="#fff" />
          )}
          <Text style={styles.useLocationButtonText}>
            {loading ? 'Getting Location...' : 'Use My Location'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addressContainer}>
        <Text style={styles.addressLabel}>Address</Text>
        <TextInput
          style={styles.addressInput}
          value={address}
          onChangeText={handleAddressChange}
          placeholder={placeholder}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          onFocus={() => setManualEdit(true)}
        />
        {manualEdit && (
          <View style={styles.manualEditActions}>
            <TouchableOpacity
              style={styles.geocodeButton}
              onPress={handleForwardGeocode}
              disabled={loading}
            >
              <Ionicons name="locate" size={16} color="#3B82F6" />
              <Text style={styles.geocodeButtonText}>Convert to Coordinates</Text>
            </TouchableOpacity>
            <Text style={styles.manualEditNote}>
              Manual entry - tap "Convert to Coordinates" to get location data
            </Text>
          </View>
        )}
      </View>

      {location?.latitude && location?.longitude && !manualEdit && (
        <View style={styles.coordinatesContainer}>
          <Text style={styles.coordinatesLabel}>Coordinates</Text>
          <Text style={styles.coordinatesText}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
          {location.accuracy && (
            <Text style={styles.accuracyText}>
              Accuracy: {location.accuracy.toFixed(1)}m ({MapService.getAccuracyLevel(location.accuracy)})
            </Text>
          )}
        </View>
      )}

      {/* Only render SimpleMap if maps are available */}
      {isMapsAvailable ? (
        <SimpleMap
          latitude={location?.latitude}
          longitude={location?.longitude}
          address={address}
          interactive={true}
          onLocationSelect={handleLocationSelect}
        />
      ) : (
        <View style={styles.noMapsContainer}>
          <Ionicons name="map-outline" size={40} color="#075eec" />
          <Text style={styles.noMapsTitle}>Location Selected</Text>
          <Text style={styles.noMapsText}>
            {location?.latitude && location?.longitude 
              ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : 'No coordinates available'
            }
          </Text>
          <Text style={styles.noMapsNote}>
            Interactive maps available in custom builds
          </Text>
        </View>
      )}

      {__DEV__ && (
        <View style={styles.locationWarning}>
          <Ionicons name="information-circle" size={16} color="#3B82F6" />
          <Text style={styles.locationWarningText}>
            Development mode: Using mock location services. Full functionality available in production builds.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationButtonContainer: {
    marginBottom: 16,
  },
  useLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#075eec',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  useLocationButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'outfit',
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'outfit',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    fontFamily: 'outfit',
  },
  manualEditActions: {
    marginTop: 8,
  },
  geocodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  geocodeButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'outfit',
  },
  manualEditNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'outfit',
  },
  coordinatesContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  coordinatesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'outfit',
  },
  coordinatesText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  accuracyText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontFamily: 'outfit',
  },
  noMapsContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  noMapsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#075eec',
    marginTop: 12,
    fontFamily: 'outfit-bold',
  },
  noMapsText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'outfit',
  },
  noMapsNote: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
    fontFamily: 'outfit',
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  locationWarningText: {
    fontSize: 12,
    color: '#3B82F6',
    marginLeft: 8,
    flex: 1,
    fontFamily: 'outfit',
  },
}); 
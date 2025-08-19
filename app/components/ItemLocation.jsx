import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SimpleMap from './SimpleMap';
import mapService from '@/app/services/mapService';

export default function ItemLocation({ 
  latitude, 
  longitude, 
  address,
  style,
  showDistance = false,
  userLocation = null,
  onLocationSelect = null,
  interactive = false,
}) {
  const [showMapModal, setShowMapModal] = useState(false);
  const [distance, setDistance] = useState(null);

  React.useEffect(() => {
    if (showDistance && userLocation && latitude && longitude) {
      calculateDistance();
    }
  }, [latitude, longitude, userLocation, showDistance]);

  const calculateDistance = async () => {
    try {
      const dist = mapService.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        latitude,
        longitude
      );
      setDistance(dist);
    } catch (error) {
      console.error('Error calculating distance:', error);
    }
  };

  const handleMapPress = () => {
    if (!latitude || !longitude) {
      Alert.alert('No Location', 'This item does not have location information.');
      return;
    }
    setShowMapModal(true);
  };

  const handleGetMyLocation = async () => {
    try {
      const location = await mapService.getLocationWithAddress();
      
      if (onLocationSelect) {
        onLocationSelect(location);
      }
      
      Alert.alert(
        'Location Found',
        `${location.address?.fullAddress || 'Location detected'}\n\nCoordinates: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      );
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        'Could not get your current location. Please check your location permissions.'
      );
    }
  };

  const renderMapModal = () => (
    <Modal
      visible={showMapModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.mapModalContainer}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>Item Location</Text>
          <TouchableOpacity
            onPress={() => setShowMapModal(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        
        <SimpleMap
          latitude={latitude}
          longitude={longitude}
          title="Item Location"
          description={address || 'Selected location'}
          height={300}
          style={styles.mapView}
        />
        
        <View style={styles.mapFooter}>
          <Text style={styles.addressText}>
            {address || 'Address not available'}
          </Text>
          <Text style={styles.coordinatesText}>
            {`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
          </Text>
          {distance && (
            <Text style={styles.distanceText}>
              {`Distance: ${distance.toFixed(1)} km`}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );

  if (!latitude && !longitude && !interactive) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.locationInfo}>
          <Ionicons name="location-outline" size={20} color="#9CA3AF" />
          <Text style={styles.noLocationText}>Location not specified</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.locationInfo}>
        <Ionicons name="location" size={20} color="#3B82F6" />
        <View style={styles.locationTextContainer}>
          <Text style={styles.locationText}>
            {typeof address === 'string'
              ? address
              : address && address.fullAddress
                ? address.fullAddress
                : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
          </Text>
          {distance && (
            <Text style={styles.distanceText}>
              {`${distance.toFixed(1)} km away`}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        {(latitude && longitude) && (
          <TouchableOpacity
            style={styles.mapButton}
            onPress={handleMapPress}
          >
            <Ionicons name="map-outline" size={16} color="#3B82F6" />
            <Text style={styles.mapButtonText}>View Map</Text>
          </TouchableOpacity>
        )}

        {interactive && (
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetMyLocation}
          >
            <Ionicons name="locate" size={16} color="#3B82F6" />
            <Text style={styles.locationButtonText}>My Location</Text>
          </TouchableOpacity>
        )}
      </View>

      {renderMapModal()}
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
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'outfit',
  },
  noLocationText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginLeft: 8,
    fontFamily: 'outfit',
  },
  distanceText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 2,
    fontFamily: 'outfit',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  mapButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'outfit',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  locationButtonText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginLeft: 4,
    fontFamily: 'outfit',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'outfit-bold',
  },
  closeButton: {
    padding: 4,
  },
  mapView: {
    margin: 16,
  },
  mapFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'outfit',
  },
  coordinatesText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
}); 
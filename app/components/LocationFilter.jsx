import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import LocationService from '@/app/services/locationService';

const RADIUS_OPTIONS = [
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
  { label: 'Any distance', value: null },
];

export default function LocationFilter({
  onFilterChange,
  style,
}) {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [useLocationFilter, setUseLocationFilter] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(25);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    // Load saved filter preferences
    loadFilterPreferences();
    checkLocationServices();
  }, []);

  const loadFilterPreferences = async () => {
    try {
      // You can implement AsyncStorage to save/load filter preferences
      // For now, we'll use default values
    } catch (error) {
      console.error('Error loading filter preferences:', error);
    }
  };

  const checkLocationServices = async () => {
    try {
      const enabled = await LocationService.isLocationEnabled();
      setLocationEnabled(enabled);
    } catch (error) {
      console.error('Error checking location services:', error);
      setLocationEnabled(false);
    }
  };

  const handleUseMyLocation = async () => {
    try {
      setLoading(true);
      
      if (!locationEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to use location-based filtering.',
          [{ text: 'OK' }]
        );
        return;
      }

      const locationData = await LocationService.getLocationWithAddress();
      setUserLocation(locationData);
      setUseLocationFilter(true);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        error.message === 'Location permission denied'
          ? 'Please enable location permissions in your device settings to use this feature.'
          : 'Failed to get your current location. Please check your location permissions.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    const filterConfig = {
      useLocationFilter,
      radius: selectedRadius,
      userLocation,
    };

    if (onFilterChange) {
      onFilterChange(filterConfig);
    }

    setShowFilterModal(false);
  };

  const handleClearFilter = () => {
    setUseLocationFilter(false);
    setUserLocation(null);
    setSelectedRadius(25);

    if (onFilterChange) {
      onFilterChange({
        useLocationFilter: false,
        radius: null,
        userLocation: null,
      });
    }

    setShowFilterModal(false);
  };

  const getFilterSummary = () => {
    if (!useLocationFilter) {
      return 'No location filter';
    }
    
    if (!userLocation) {
      return 'Location not set';
    }

    const radiusText = selectedRadius ? `${selectedRadius} km` : 'Any distance';
    return `${userLocation.address.city || 'Current location'} (${radiusText})`;
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilterModal(true)}
      >
        <Ionicons name="filter" size={20} color="#3B82F6" />
        <Text style={styles.filterButtonText}>Location Filter</Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      <Text style={styles.filterSummary}>{getFilterSummary()}</Text>

      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Location Filter</Text>
            <TouchableOpacity
              onPress={() => setShowFilterModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Use My Location</Text>
              <Text style={styles.sectionDescription}>
                Filter items based on your current location
              </Text>
              
              <TouchableOpacity
                style={[
                  styles.locationToggle,
                  useLocationFilter && styles.locationToggleActive
                ]}
                onPress={() => setUseLocationFilter(!useLocationFilter)}
              >
                <View style={styles.toggleContent}>
                  <Ionicons 
                    name="location" 
                    size={20} 
                    color={useLocationFilter ? '#fff' : '#6B7280'} 
                  />
                  <Text style={[
                    styles.toggleText,
                    useLocationFilter && styles.toggleTextActive
                  ]}>
                    Enable location-based filtering
                  </Text>
                </View>
                <View style={[
                  styles.toggleSwitch,
                  useLocationFilter && styles.toggleSwitchActive
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    useLocationFilter && styles.toggleKnobActive
                  ]} />
                </View>
              </TouchableOpacity>

              {useLocationFilter && (
                <View style={styles.locationSection}>
                  {userLocation ? (
                    <View style={styles.locationInfo}>
                      <Text style={styles.locationLabel}>Current Location:</Text>
                      <Text style={styles.locationText}>
                        {userLocation.address.fullAddress}
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.getLocationButton}
                      onPress={handleUseMyLocation}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="location" size={16} color="#fff" />
                      )}
                      <Text style={styles.getLocationButtonText}>
                        {loading ? 'Getting Location...' : 'Get My Location'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {useLocationFilter && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Search Radius</Text>
                <Text style={styles.sectionDescription}>
                  Show items within this distance from your location
                </Text>
                
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedRadius}
                    onValueChange={setSelectedRadius}
                    style={styles.picker}
                  >
                    {RADIUS_OPTIONS.map((option) => (
                      <Picker.Item
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearFilter}
            >
              <Text style={styles.clearButtonText}>Clear Filter</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApplyFilter}
            >
              <Text style={styles.applyButtonText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  filterSummary: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontWeight: '600',
    color: '#374151',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  locationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationToggleActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  toggleTextActive: {
    color: '#1E40AF',
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    backgroundColor: '#D1D5DB',
    borderRadius: 12,
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#3B82F6',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  locationSection: {
    marginTop: 16,
  },
  locationInfo: {
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#0C4A6E',
  },
  getLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  getLocationButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  picker: {
    height: 50,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
}); 
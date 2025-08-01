import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Conditional import for expo-location (disabled for Expo Go compatibility)
let Location = null;
let isLocationAvailable = false;
try {
  Location = require('expo-location');
  isLocationAvailable = true;
} catch (error) {
  console.warn('expo-location not available in Expo Go');
  isLocationAvailable = false;
}

// Conditional import for react-native-maps
let MapView = null;
let Marker = null;
let isMapsAvailable = false;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  isMapsAvailable = true;
} catch (error) {
  console.warn('react-native-maps not available in Expo Go');
  isMapsAvailable = false;
}

export default function MapPicker({
  initialLocation,
  onLocationSelected,
  onCancel,
  confirmLabel = 'Confirm Location',
  style,
}) {
  const [region, setRegion] = useState(null);
  const [marker, setMarker] = useState(initialLocation || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Check if expo-location is available
        if (!isLocationAvailable) {
          setError('Location services not available in Expo Go. Please use a custom build for full functionality.');
          setLoading(false);
          return;
        }

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          setLoading(false);
          return;
        }
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { latitude, longitude } = loc.coords;
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        if (!marker) setMarker({ latitude, longitude });
      } catch (e) {
        setError('Could not fetch location.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleMapPress = (e) => {
    setMarker(e.nativeEvent.coordinate);
  };

  const handleManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude and longitude values.');
      return;
    }
    
    if (lat < -90 || lat > 90) {
      Alert.alert('Invalid Latitude', 'Latitude must be between -90 and 90.');
      return;
    }
    
    if (lng < -180 || lng > 180) {
      Alert.alert('Invalid Longitude', 'Longitude must be between -180 and 180.');
      return;
    }
    
    const coords = { latitude: lat, longitude: lng };
    setMarker(coords);
    if (onLocationSelected) {
      onLocationSelected(coords);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, style]}>
        <ActivityIndicator size="large" color="#075eec" />
        <Text style={styles.loadingText}>Fetching your location...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, style]}>
        <Ionicons name="alert-circle" size={40} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        
        {/* Manual Location Input for Expo Go */}
        <View style={styles.manualInputContainer}>
          <Text style={styles.manualInputTitle}>Enter Coordinates Manually:</Text>
          <TextInput
            style={styles.manualInput}
            placeholder="Latitude (e.g., 37.78825)"
            value={manualLat}
            onChangeText={setManualLat}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.manualInput}
            placeholder="Longitude (e.g., -122.4324)"
            value={manualLng}
            onChangeText={setManualLng}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.manualButton} onPress={handleManualLocation}>
            <Text style={styles.manualButtonText}>Set Location</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity style={styles.retryButton} onPress={() => setError(null)}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // If maps are not available, show manual input
  if (!isMapsAvailable) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.expoGoContainer}>
          <Ionicons name="map-outline" size={60} color="#075eec" />
          <Text style={styles.expoGoTitle}>Interactive Maps</Text>
          <Text style={styles.expoGoSubtitle}>
            Interactive maps are not available in Expo Go. Please use a custom build for full functionality.
          </Text>
          
          <View style={styles.manualInputContainer}>
            <Text style={styles.manualInputTitle}>Enter Coordinates Manually:</Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Latitude (e.g., 37.78825)"
              value={manualLat}
              onChangeText={setManualLat}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.manualInput}
              placeholder="Longitude (e.g., -122.4324)"
              value={manualLng}
              onChangeText={setManualLng}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.manualButton} onPress={handleManualLocation}>
              <Text style={styles.manualButtonText}>Set Location</Text>
            </TouchableOpacity>
          </View>
          
          {onCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Only render MapView if maps are available
  if (!MapView) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
        loadingEnabled
        zoomEnabled
        scrollEnabled
        pitchEnabled
        rotateEnabled
      >
        {marker && <Marker coordinate={marker} draggable onDragEnd={e => setMarker(e.nativeEvent.coordinate)} />}
      </MapView>
      <View style={styles.infoBox}>
        <Text style={styles.coordText}>
          {marker ? `Lat: ${marker.latitude.toFixed(6)}, Lng: ${marker.longitude.toFixed(6)}` : 'Tap map to select location'}
        </Text>
        <TouchableOpacity
          style={[styles.confirmButton, !marker && { backgroundColor: '#ccc' }]}
          onPress={() => marker && onLocationSelected && onLocationSelected(marker)}
          disabled={!marker}
        >
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </TouchableOpacity>
        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1, borderRadius: 16 },
  infoBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  coordText: {
    fontSize: 16,
    color: '#075eec',
    marginBottom: 8,
    fontFamily: 'outfit',
  },
  confirmButton: {
    backgroundColor: '#075eec',
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 24,
    marginTop: 8,
    marginBottom: 4,
  },
  confirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'outfit-bold',
  },
  cancelButton: {
    marginTop: 8,
    padding: 8,
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 15,
    fontFamily: 'outfit',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#075eec',
    fontSize: 16,
    fontFamily: 'outfit',
  },
  errorText: {
    marginTop: 16,
    color: '#FF3B30',
    fontSize: 16,
    fontFamily: 'outfit',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#075eec',
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: 'outfit',
  },
  expoGoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },
  expoGoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#075eec',
    marginTop: 16,
    fontFamily: 'outfit-bold',
  },
  expoGoSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
    fontFamily: 'outfit',
  },
  manualInputContainer: {
    width: '100%',
    marginTop: 16,
  },
  manualInputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    fontFamily: 'outfit',
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    fontFamily: 'outfit',
  },
  manualButton: {
    backgroundColor: '#075eec',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'outfit',
  },
}); 
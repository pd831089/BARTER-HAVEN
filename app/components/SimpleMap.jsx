import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

export default function SimpleMap({ 
  latitude, 
  longitude, 
  title = 'Selected Location',
  description = '',
  style,
  height = 200,
  showMarker = true,
  region = null,
  showFallback = true
}) {
  if (!latitude || !longitude) {
    return (
      <View style={[styles.placeholder, { height }, style]}>
        <Text style={styles.placeholderText}>No location available</Text>
      </View>
    );
  }

  // If maps are not available and fallback is disabled, return null
  if (!isMapsAvailable && !showFallback) {
    return null;
  }

  // If maps are not available, show a fallback UI
  if (!isMapsAvailable) {
    return (
      <View style={[styles.expoGoFallback, { height }, style]}>
        <Ionicons name="location" size={40} color="#075eec" />
        <Text style={styles.expoGoTitle}>{title}</Text>
        <Text style={styles.expoGoDescription}>{description}</Text>
        <Text style={styles.expoGoCoords}>
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
        <Text style={styles.expoGoNote}>
          Interactive maps available in custom builds
        </Text>
      </View>
    );
  }

  // Only render MapView if maps are available
  if (!MapView) {
    return null;
  }

  const mapRegion = region || {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <MapView
      style={[styles.map, { height }, style]}
      region={mapRegion}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      {showMarker && (
        <Marker
          coordinate={{ latitude, longitude }}
          title={title}
          description={description}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 16,
    fontFamily: 'outfit',
  },
  expoGoFallback: {
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    padding: 20,
  },
  expoGoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#075eec',
    marginTop: 12,
    fontFamily: 'outfit-bold',
  },
  expoGoDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'outfit',
  },
  expoGoCoords: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  expoGoNote: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 8,
    fontFamily: 'outfit',
  },
}); 
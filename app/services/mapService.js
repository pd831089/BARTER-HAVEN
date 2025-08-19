import { Platform } from 'react-native';
import { supabase } from '@/Config/supabaseConfig';

class MapService {
  constructor() {
    this.isNativeAvailable = false;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Check if native modules are available
      if (!__DEV__ && Platform.OS !== 'web') {
        // const Location = await import('expo-location'); // Disabled for Expo Go compatibility
        this.Location = Location;
        this.isNativeAvailable = true;
        console.log('Map service: Native modules available');
      } else {
        console.log('Map service: Using mock/fallback mode');
      }
    } catch (error) {
      console.warn('Map service: Native modules not available, using fallbacks');
      this.isNativeAvailable = false;
    }
    
    this.initialized = true;
  }

  // Check if location services are available
  async isLocationAvailable() {
    await this.initialize();
    
    if (!this.isNativeAvailable) {
      return false;
    }

    try {
      const { status } = await this.Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }

  // Request location permissions
  async requestLocationPermissions() {
    await this.initialize();
    
    if (!this.isNativeAvailable) {
      return false;
    }

    try {
      const { status } = await this.Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  // Get current location
  async getCurrentLocation() {
    await this.initialize();
    
    if (!this.isNativeAvailable) {
      // Return mock location for development
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        accuracy: 5,
        address: {
          street: '1 Hacker Way',
          city: 'San Francisco',
          region: 'CA',
          postalCode: '94301',
          country: 'US',
          fullAddress: '1 Hacker Way, San Francisco, CA 94301, US'
        },
        isMock: true
      };
    }

    try {
      const hasPermission = await this.isLocationAvailable();
      if (!hasPermission) {
        const granted = await this.requestLocationPermissions();
        if (!granted) {
          throw new Error('Location permission denied');
        }
      }

      const location = await this.Location.getCurrentPositionAsync({
        accuracy: this.Location.Accuracy.Balanced,
        maximumAge: 10000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    }
  }

  // Reverse geocode (coordinates to address)
  async reverseGeocode(latitude, longitude) {
    await this.initialize();
    
    if (!this.isNativeAvailable) {
      // Return mock address for development
      return {
        street: 'Mock Street',
        city: 'Mock City',
        region: 'Mock Region',
        postalCode: '12345',
        country: 'Mock Country',
        fullAddress: `Mock Street, Mock City, Mock Region 12345, Mock Country (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
      };
    }

    try {
      const results = await this.Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (results.length === 0) {
        throw new Error('No address found for coordinates');
      }

      const location = results[0];
      return {
        street: location.street || '',
        city: location.city || location.subregion || '',
        region: location.region || '',
        postalCode: location.postalCode || '',
        country: location.country || '',
        fullAddress: [
          location.street,
          location.city || location.subregion,
          location.region,
          location.postalCode,
          location.country,
        ].filter(Boolean).join(', ')
      };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  // Forward geocode (address to coordinates)
  async forwardGeocode(address) {
    await this.initialize();
    
    if (!this.isNativeAvailable) {
      // Return mock coordinates for development
      const hash = this.simpleHash(address);
      return {
        latitude: 37.78825 + (hash % 100) / 1000,
        longitude: -122.4324 + (hash % 100) / 1000,
        isMock: true
      };
    }

    try {
      const results = await this.Location.geocodeAsync(address);

      if (results.length === 0) {
        throw new Error('No coordinates found for address');
      }

      const location = results[0];
      return {
        latitude: location.latitude,
        longitude: location.longitude,
      };
    } catch (error) {
      console.error('Error forward geocoding:', error);
      throw error;
    }
  }

  // Calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Get location with address
  async getLocationWithAddress() {
    try {
      const location = await this.getCurrentLocation();
      
      if (location.isMock) {
        return location;
      }

      const address = await this.reverseGeocode(location.latitude, location.longitude);
      
      return {
        ...location,
        address,
      };
    } catch (error) {
      console.error('Error getting location with address:', error);
      throw error;
    }
  }

  // Find items within radius
  async findItemsWithinRadius(userLat, userLon, radiusKm = 50) {
    try {
      // Try server-side function first
      const { data, error } = await supabase
        .rpc('bh_find_items_within_radius', {
          user_lat: userLat,
          user_lon: userLon,
          radius_km: radiusKm,
        });

      if (!error && data) {
        return data;
      }

      // Fallback to client-side filtering
      console.warn('Using client-side location filtering');
      const { data: allItems, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;

      // Filter items within radius
      const filteredItems = allItems.filter(item => {
        if (!item.latitude || !item.longitude) return false;
        const distance = this.calculateDistance(
          userLat, userLon, item.latitude, item.longitude
        );
        return distance <= radiusKm;
      });

      return filteredItems.map(item => ({
        ...item,
        distance_km: this.calculateDistance(
          userLat, userLon, item.latitude, item.longitude
        )
      }));
    } catch (error) {
      console.error('Error finding items within radius:', error);
      throw error;
    }
  }

  // Save location to database
  async saveLocation(table, id, locationData) {
    try {
      const updateData = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        location_updated_at: new Date().toISOString(),
      };

      if (locationData.address) {
        updateData.address_street = locationData.address.street;
        updateData.address_city = locationData.address.city;
        updateData.address_region = locationData.address.region;
        updateData.address_postal_code = locationData.address.postalCode;
        updateData.address_country = locationData.address.country;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving location:', error);
      throw error;
    }
  }

  // Get accuracy level description
  getAccuracyLevel(accuracy) {
    if (accuracy < 10) return 'Excellent';
    if (accuracy < 50) return 'Good';
    if (accuracy < 100) return 'Fair';
    return 'Poor';
  }

  // Simple hash function for mock coordinates
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Create map region from coordinates
  createMapRegion(latitude, longitude, latitudeDelta = 0.01, longitudeDelta = 0.01) {
    return {
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
    };
  }

  // Check if coordinates are valid
  isValidCoordinate(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    );
  }
}

export default new MapService(); 
import { supabase } from '@/Config/supabaseConfig';

export class LocationService {
  // Check if native location services are available
  static async isNativeLocationAvailable() {
    // For Expo Go compatibility, return false
    return false;
  }

  // Request location permissions (fallback)
  static async requestLocationPermission() {
    console.warn('Location permission not available in Expo Go');
    return false;
  }

  // Get current location with high accuracy (fallback)
  static async getCurrentLocation() {
    console.warn('Location services not available in Expo Go - using mock data');
    // Return mock location data for Expo Go
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      accuracy: 100,
      altitude: 0,
      heading: 0,
      speed: 0,
    };
  }

  // Watch location changes (fallback)
  static async watchLocation(callback) {
    console.warn('Location watching not available in Expo Go');
    throw new Error('Location services not available in Expo Go');
  }

  // Reverse geocode coordinates to address (fallback)
  static async reverseGeocode(latitude, longitude) {
    console.warn('Reverse geocoding not available in Expo Go - using mock data');
    return {
      street: 'Mock Street',
      city: 'Mock City',
      region: 'Mock Region',
      postalCode: '12345',
      country: 'Mock Country',
      fullAddress: `Mock Address at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    };
  }

  // Forward geocode address to coordinates (fallback)
  static async forwardGeocode(address) {
    console.warn('Forward geocoding not available in Expo Go - using mock data');
    return {
      latitude: 37.78825,
      longitude: -122.4324,
    };
  }

  // Format address components into a readable string
  static formatAddress(address) {
    const parts = [
      address.street,
      address.city,
      address.region,
      address.postalCode,
      address.country,
    ].filter(Boolean);

    return parts.join(', ');
  }

  // Save user location to Supabase
  static async saveUserLocation(userId, locationData) {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving user location:', error);
      return false;
    }
  }

  // Save item location to Supabase
  static async saveItemLocation(itemId, locationData) {
    try {
      const { error } = await supabase
        .from('items')
        .update({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error saving item location:', error);
      return false;
    }
  }

  // Get user location from Supabase
  static async getUserLocation(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('latitude, longitude, location_updated_at')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user location:', error);
      return null;
    }
  }

  // Find items within a certain radius
  static async findItemsWithinRadius(userLat, userLon, radiusKm = 50) {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;

      // Filter items within radius
      const itemsInRadius = data.filter(item => {
        const distance = this.calculateHaversineDistance(
          userLat, userLon, item.latitude, item.longitude
        );
        return distance <= radiusKm;
      });

      return itemsInRadius;
    } catch (error) {
      console.error('Error finding items within radius:', error);
      return [];
    }
  }

  // Calculate distance between two points using Haversine formula
  static calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  // Calculate distance between two points
  static async calculateDistance(lat1, lon1, lat2, lon2) {
    return this.calculateHaversineDistance(lat1, lon1, lat2, lon2);
  }

  // Get location with address (combined function)
  static async getLocationWithAddress() {
    try {
      const location = await this.getCurrentLocation();
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

  // Get nearby places (mock implementation for Expo Go)
  static async getNearbyPlaces(latitude, longitude, radius = 1000) {
    console.warn('Nearby places not available in Expo Go - using mock data');
    return [
      { name: 'Mock Place 1', distance: 0.5 },
      { name: 'Mock Place 2', distance: 1.2 },
      { name: 'Mock Place 3', distance: 2.1 },
    ];
  }

  // Check if location services are enabled
  static async isLocationEnabled() {
    console.warn('Location services check not available in Expo Go');
    return false;
  }

  // Get accuracy level description
  static getAccuracyLevel(accuracy) {
    if (accuracy <= 5) return 'Excellent';
    if (accuracy <= 10) return 'Good';
    if (accuracy <= 20) return 'Fair';
    if (accuracy <= 50) return 'Poor';
    return 'Very Poor';
  }
}

export default LocationService; 
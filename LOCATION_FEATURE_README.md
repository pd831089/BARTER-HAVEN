# Location Features Implementation Guide

## Overview

BarterHaven now includes comprehensive location functionality with interactive maps, current location detection, and location-based features. This guide covers the implementation details, configuration, and usage.

## Features Implemented

### 1. Interactive Map Picker (`MapPicker.jsx`)
- **Full-screen interactive map** using `react-native-maps`
- **Current location detection** with `expo-location`
- **Tap-to-place markers** for location selection
- **Draggable markers** for precise location picking
- **Permission handling** with graceful error states
- **Loading and error UI** with retry functionality
- **Coordinates display** and confirmation flow

### 2. Delivery Details Integration
- **Map-based location selection** in delivery details screen
- **Automatic address reverse geocoding** from coordinates
- **Location persistence** to Supabase database
- **Fallback to manual text input** if map is unavailable

### 3. Simple Map Display (`SimpleMap.jsx`)
- **Static map display** for showing selected locations
- **Marker placement** with custom titles and descriptions
- **Responsive design** with configurable height
- **Placeholder states** for missing location data

### 4. Location Service (`mapService.js`)
- **Current location fetching** with permission handling
- **Reverse geocoding** (coordinates to address)
- **Forward geocoding** (address to coordinates)
- **Distance calculations** between locations
- **Location persistence** to Supabase tables
- **Mock data support** for development/testing

## Configuration

### Required Dependencies

```bash
npx expo install expo-location react-native-maps
```

### App Configuration (`app.json`)

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "BarterHaven uses your location to help you find nearby items and users for better trading opportunities.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "BarterHaven uses your location to help you find nearby items and users for better trading opportunities."
      },
      "config": {
        "googleMapsApiKey": "YOUR_IOS_GOOGLE_MAPS_API_KEY"
      }
    },
    "android": {
      "permissions": [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION"
      ],
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_GOOGLE_MAPS_API_KEY"
        }
      }
    }
  }
}
```

### Google Maps API Keys

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Maps SDK**
   - Enable "Maps SDK for iOS" and "Maps SDK for Android"
   - Enable "Places API" for geocoding features

3. **Generate API Keys**
   - Create separate API keys for iOS and Android
   - Restrict keys to your app's bundle ID/package name
   - Add appropriate API restrictions

## Usage Examples

### 1. Using MapPicker Component

```jsx
import MapPicker from './components/MapPicker';

// In your component
const [showMapPicker, setShowMapPicker] = useState(false);
const [selectedLocation, setSelectedLocation] = useState(null);

const handleLocationSelected = (coords) => {
  setSelectedLocation(coords);
  setShowMapPicker(false);
};

// In your JSX
<Modal visible={showMapPicker} animationType="slide">
  <MapPicker
    initialLocation={selectedLocation}
    onLocationSelected={handleLocationSelected}
    onCancel={() => setShowMapPicker(false)}
    confirmLabel="Confirm Location"
  />
</Modal>
```

### 2. Using SimpleMap Component

```jsx
import SimpleMap from './components/SimpleMap';

// Display a location
<SimpleMap
  latitude={37.78825}
  longitude={-122.4324}
  title="Meetup Location"
  description="Coffee shop downtown"
  height={200}
/>
```

### 3. Using MapService

```jsx
import mapService from './services/mapService';

// Get current location
const location = await mapService.getCurrentLocation();

// Reverse geocode coordinates
const address = await mapService.reverseGeocode(latitude, longitude);

// Save location to database
await mapService.saveLocation('items', itemId, {
  latitude: location.latitude,
  longitude: location.longitude,
  address: address
});
```

## Database Schema

### Location Fields in Tables

The following tables support location data:

```sql
-- Example location fields
latitude DECIMAL(10, 8),
longitude DECIMAL(11, 8),
address_street TEXT,
address_city TEXT,
address_region TEXT,
address_postal_code TEXT,
address_country TEXT,
location_updated_at TIMESTAMP WITH TIME ZONE
```

### Trade Details Location

When a user selects a location in delivery details:

1. **Coordinates** are stored in `trade_details` table
2. **Address** is reverse-geocoded and stored
3. **Location metadata** includes update timestamp

## Production Build Considerations

### Expo Go Limitations

- **Maps don't render** in Expo Go due to native module requirements
- **Location services** are mocked/disabled for compatibility
- **Use custom dev builds** or production builds for full functionality

### Building for Production

```bash
# Install EAS CLI
npm install -g @expo/eas-cli

# Configure build
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

### Testing Location Features

1. **Test on physical device** (not simulator)
2. **Enable location services** on device
3. **Grant location permissions** when prompted
4. **Test in different network conditions**

## Error Handling

### Common Issues

1. **"react-native-maps not properly linked"**
   ```bash
   npm uninstall react-native-maps
   npx expo install react-native-maps
   ```

2. **"Location permission denied"**
   - Check app permissions in device settings
   - Ensure proper permission descriptions in app.json

3. **"Google Maps API key error"**
   - Verify API keys are correct
   - Check API key restrictions
   - Ensure Maps SDK is enabled

4. **"Map not rendering in Expo Go"**
   - This is expected behavior
   - Use custom dev build or production build

### Debugging Tips

```jsx
// Enable debug logging
console.log('Location data:', location);
console.log('Map region:', region);
console.log('Selected coordinates:', coords);
```

## Performance Considerations

### Optimization Strategies

1. **Lazy load maps** only when needed
2. **Cache location data** to reduce API calls
3. **Use appropriate zoom levels** for different use cases
4. **Implement location batching** for multiple items

### Memory Management

```jsx
// Clean up map resources
useEffect(() => {
  return () => {
    // Cleanup map references if needed
  };
}, []);
```

## Security Best Practices

1. **Restrict Google Maps API keys** to your app's bundle ID
2. **Use environment variables** for API keys in production
3. **Validate location data** before storing
4. **Implement rate limiting** for geocoding requests

## Future Enhancements

### Planned Features

1. **Real-time location sharing** during trades
2. **Location-based notifications** for nearby items
3. **Route planning** to meetup locations
4. **Location clustering** for multiple items
5. **Offline map support** for poor connectivity

### Integration Opportunities

1. **Push notifications** based on location
2. **Analytics** for location-based user behavior
3. **A/B testing** for location features
4. **User preferences** for location privacy

## Support and Resources

- [React Native Maps Documentation](https://github.com/react-native-maps/react-native-maps)
- [Expo Location Documentation](https://docs.expo.dev/versions/latest/sdk/location/)
- [Google Maps Platform](https://developers.google.com/maps)
- [Expo Build Documentation](https://docs.expo.dev/build/introduction/)

## Troubleshooting

### Build Issues

```bash
# Clear cache and reinstall
npx expo install --fix
rm -rf node_modules
npm install

# Rebuild with clean cache
eas build --clear-cache
```

### Runtime Issues

1. **Check device location settings**
2. **Verify network connectivity**
3. **Test with different API keys**
4. **Review console logs for errors**

---

**Last Updated:** December 2024
**Version:** 2.0.0 
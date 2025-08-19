// Utility to check for native module availability
// This helps prevent errors when modules are not available in Expo Go

export const NativeModules = {
  // Check if expo-location is available
  isLocationAvailable: false,
  // Check if react-native-maps is available
  isMapsAvailable: false,
  // Check if expo-notifications is available
  isNotificationsAvailable: false,
};

// Initialize module availability checks
try {
  require('expo-location');
  NativeModules.isLocationAvailable = true;
} catch (error) {
  console.warn('expo-location not available in Expo Go');
  NativeModules.isLocationAvailable = false;
}

try {
  require('react-native-maps');
  NativeModules.isMapsAvailable = true;
} catch (error) {
  console.warn('react-native-maps not available in Expo Go');
  NativeModules.isMapsAvailable = false;
}

try {
  require('expo-notifications');
  NativeModules.isNotificationsAvailable = true;
} catch (error) {
  console.warn('expo-notifications not available in Expo Go');
  NativeModules.isNotificationsAvailable = false;
}

// Helper function to check if we're in Expo Go
export const isExpoGo = () => {
  return !NativeModules.isMapsAvailable || !NativeModules.isLocationAvailable;
};

// Helper function to show development warning
export const showDevWarning = (feature) => {
  if (__DEV__ && isExpoGo()) {
    console.warn(`Development mode: ${feature} not available in Expo Go. Full functionality available in production builds.`);
  }
};

export default NativeModules; 
import React, { useState, createContext } from 'react';
import { Tabs, useNavigation } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import Entypo from '@expo/vector-icons/Entypo';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View, TextInput, Image, TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/Config/supabaseConfig';
import { useNotifications } from '@/context/NotificationContext';
import NotificationCenter from '@/app/components/NotificationCenter';
import NotificationPreferences from '@/app/components/NotificationPreferences';

export const SearchContext = createContext();

export default function Tablayout() {
  const navigation = useNavigation();
  const [search, setSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showNotificationPreferences, setShowNotificationPreferences] = useState(false);
  const { notificationCount, chatBadgeCount } = useNotifications();

  return (
    <SearchContext.Provider value={{ search, setSearch }}>
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            style={{ position: 'absolute', left: 0, padding: 12, borderRadius: 24 }}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Ionicons name="menu" size={28} color="#075eec" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Image source={require('../../../assets/images/BH_LOGO.png')} style={styles.logo} />
          </View>
          <TouchableOpacity
            onPress={() => setShowNotificationCenter(true)}
            style={styles.notificationButton}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Ionicons name="notifications" size={24} color="#075eec" />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={[styles.searchBarContainer, isFocused && styles.searchBarFocused]}>
          <Ionicons name="search" size={20} color="#075eec" style={{ marginLeft: 12, marginRight: 6 }} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search by name, category..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Bottom Tabs with Gradient Background */}
      <Tabs
        screenOptions={{
          tabBarStyle: styles.tabBarStyle,
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.7)',
          tabBarShowLabel: false,
          tabBarIconStyle: { marginTop: 6 },
          tabBarBackground: () => (
            <LinearGradient
              colors={["#075eec", "#3B82F6", "#67C6FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tabBarGradient}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name="home" size={size} color={color} style={focused ? styles.activeIcon : {}} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <MaterialIcons name="explore" size={size} color={color} style={focused ? styles.activeIcon : {}} />
            ),
          }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <Entypo name="upload" size={size} color={color} style={focused ? styles.activeIcon : {}} />
            ),
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <View style={styles.tabIconContainer}>
                <Entypo name="chat" size={size} color={color} style={focused ? styles.activeIcon : {}} />
                {chatBadgeCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {chatBadgeCount > 9 ? '9+' : chatBadgeCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <AntDesign name="profile" size={size} color={color} style={focused ? styles.activeIcon : {}} />
            ),
          }}
        />
      </Tabs>

      {/* Notification Modals */}
      <NotificationCenter
        visible={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
      />
      
      <NotificationPreferences
        visible={showNotificationPreferences}
        onClose={() => setShowNotificationPreferences(false)}
      />
    </SearchContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    paddingTop: 0, // Adjust top padding
    paddingBottom: 15, // Extra space for search bar
    paddingHorizontal: 20,
    elevation: 4,
    position: 'relative',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10, // Space for search bar
    position: 'relative',
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '70%',
    height: 65,
    resizeMode: 'contain',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#e6e6e6',
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginTop: 2,
    marginBottom: 2,
    elevation: 3,
    shadowColor: '#075eec',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  searchBarFocused: {
    borderColor: '#075eec',
    shadowOpacity: 0.18,
  },
  searchBar: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#000',
    borderWidth: 0,
  },
  tabBarGradient: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tabBarStyle: {
    backgroundColor: 'transparent',
    height: 50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0,
    elevation: 12,
    shadowColor: '#833AB4',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  activeIcon: {
    transform: [{ scale: 1.15 }],
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  notificationButton: {
    position: 'absolute',
    right: 0,
    padding: 12,
    borderRadius: 24,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

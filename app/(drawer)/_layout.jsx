import React, { createContext, useState } from 'react';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { View, Text, StyleSheet, Image, Alert, Animated, Pressable } from 'react-native';
import { useAuth } from '@/Config/AuthContext';
import { supabase } from '@/Config/supabaseConfig';

export const TradesRefreshContext = createContext({ refresh: () => {} });

function CustomDrawerContent(props) {
    const { user } = useAuth();
    const [profile, setProfile] = React.useState(null);
    const { state } = props;
    const currentRoute = state?.routeNames[state.index] || '';

    React.useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
        if (!error && data) {
            setProfile(data);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await supabase.auth.signOut();
                        } catch (error) {
                            console.error('Logout error:', error);
                            Alert.alert('Error', 'Failed to logout. Please try again.');
                        }
                    }
                }
            ],
            { cancelable: true }
        );
    };

    const getActiveColor = (routeName) => {
        return currentRoute === routeName ? '#fff' : '#075eec';
    };

    const CustomDrawerItem = ({ label, iconName, routeName, onPress, isLogout = false }) => {
        const [isHovered, setIsHovered] = React.useState(false);
        const isActive = currentRoute === routeName;
        const scaleAnim = React.useRef(new Animated.Value(1)).current;
        
        const startHoverAnimation = () => {
            setIsHovered(true);
            Animated.spring(scaleAnim, {
                toValue: 1.02,
                friction: 7,
                tension: 40,
                useNativeDriver: true
            }).start();
        };

        const endHoverAnimation = () => {
            setIsHovered(false);
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 7,
                tension: 40,
                useNativeDriver: true
            }).start();
        };

        return (
            <Pressable
                onPressIn={startHoverAnimation}
                onPressOut={endHoverAnimation}
                onHoverIn={startHoverAnimation}
                onHoverOut={endHoverAnimation}
                onPress={onPress}
                style={({ pressed }) => [
                    styles.drawerItemContainer,
                    (isActive || isHovered) && (isLogout ? styles.activeLogoutItem : styles.activeDrawerItem),
                    pressed && styles.pressedDrawerItem
                ]}
            >
                <Animated.View style={[
                    styles.drawerItemContent,
                    { transform: [{ scale: scaleAnim }] }
                ]}>
                    <Ionicons
                        name={iconName}
                        size={22}
                        color={isLogout 
                            ? (isHovered ? '#fff' : '#FF3B30') 
                            : (isActive || isHovered ? '#fff' : '#075eec')}
                    />
                    <Text style={[
                        styles.drawerLabel,
                        isLogout ? styles.logoutLabel : null,
                        (isActive || isHovered) && !isLogout && styles.activeDrawerLabel,
                        isLogout && isHovered && styles.activeLogoutLabel
                    ]}>
                        {label}
                    </Text>
                </Animated.View>
            </Pressable>
        );
    };

    return (
        <DrawerContentScrollView {...props} style={styles.drawerContent}>
            {/* User Profile Section */}
            <View style={styles.userSection}>
                <View style={styles.profileImage}>
                    {profile?.profile_image_url ? (
                        <Image
                            source={{ uri: profile.profile_image_url }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatar, styles.defaultAvatar]}>
                            <Text style={styles.avatarText}>
                                {profile?.name?.[0]?.toUpperCase() || "?"}
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={styles.welcomeText}>Welcome,</Text>
                <Text style={styles.userName}>{profile?.name || 'User'}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
            </View>

            {/* Navigation Items */}
            <View style={styles.drawerItems}>
                <CustomDrawerItem
                    label="Home"
                    iconName="home-outline"
                    routeName="(tabs)"
                    onPress={() => {
                        props.navigation.navigate('(tabs)');
                        setTimeout(() => {
                            props.navigation.navigate('(tabs)/home');
                        }, 0);
                    }}
                />
                <CustomDrawerItem
                    label="Browse Items"
                    iconName="search-outline"
                    routeName="browse"
                    onPress={() => props.navigation.navigate('browse')}
                />
                <CustomDrawerItem
                    label="My Trades"
                    iconName="swap-horizontal-outline"
                    routeName="trades"
                    onPress={() => props.navigation.navigate('trades')}
                />
                <CustomDrawerItem
                    label="Settings"
                    iconName="settings-outline"
                    routeName="settings"
                    onPress={() => props.navigation.navigate('settings')}
                />
                <CustomDrawerItem
                    label="Logout"
                    iconName="log-out-outline"
                    routeName="logout"
                    onPress={handleLogout}
                    isLogout={true}
                />
            </View>
        </DrawerContentScrollView>
    );
}

export default function DrawerLayout() {
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = () => setRefreshKey(k => k + 1);
    return (
        <TradesRefreshContext.Provider value={{ refresh }}>
            <Drawer
                key={refreshKey}
                drawerContent={(props) => <CustomDrawerContent {...props} />}
                screenOptions={{
                    headerShown: false,
                    drawerStyle: {
                        backgroundColor: '#fff',
                        width: 280,
                    },
                    drawerActiveBackgroundColor: '#075eec',
                    drawerActiveTintColor: '#fff',
                    drawerInactiveTintColor: '#075eec',
                }}
            >
                <Drawer.Screen
                    name="(tabs)"
                    options={{
                        headerShown: false,
                    }}
                />
                <Drawer.Screen
                    name="browse"
                    options={{
                        headerShown: false,
                    }}
                />
                <Drawer.Screen
                    name="trades"
                    options={{
                        headerShown: true,
                        title: 'My Trades',
                        headerStyle: {
                            backgroundColor: '#fff',
                        },
                        headerTitleStyle: {
                            color: '#075eec',
                            fontFamily: 'outfit-bold',
                            fontSize: 20,
                        },
                        headerTintColor: '#075eec',
                    }}
                />
                <Drawer.Screen
                    name="settings"
                    options={{
                        headerShown: true,
                        title: 'Settings',
                        headerStyle: {
                            backgroundColor: '#fff',
                        },
                        headerTitleStyle: {
                            color: '#075eec',
                            fontFamily: 'outfit-bold',
                            fontSize: 20,
                        },
                        headerTintColor: '#075eec',
                    }}
                />
            </Drawer>
        </TradesRefreshContext.Provider>
    );
}

const styles = StyleSheet.create({
    drawerContent: {
        flex: 1,
    },
    userSection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    profileImage: {
        marginBottom: 12,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#075eec',
    },
    defaultAvatar: {
        backgroundColor: '#075eec',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    welcomeText: {
        fontSize: 16,
        color: '#6B7280',
        fontFamily: 'outfit',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#075eec',
        marginTop: 4,
        fontFamily: 'outfit-bold',
    },
    userEmail: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
        fontFamily: 'outfit',
    },
    drawerItems: {
        flex: 1,
        paddingTop: 8,
    },
    drawerItemContainer: {
        marginHorizontal: 12,
        marginVertical: 4,
        borderRadius: 16,
        overflow: 'hidden',
    },
    drawerItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    activeDrawerItem: {
        backgroundColor: '#075eec',
    },
    activeLogoutItem: {
        backgroundColor: '#FF3B30',
    },
    pressedDrawerItem: {
        opacity: 0.8,
    },
    drawerLabel: {
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'outfit',
        color: '#075eec',
        marginLeft: 32,
    },
    activeDrawerLabel: {
        color: '#fff',
    },
    logoutLabel: {
        color: '#FF3B30',
    },
    activeLogoutLabel: {
        color: '#fff',
    },
});

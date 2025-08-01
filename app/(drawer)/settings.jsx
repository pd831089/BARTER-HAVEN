import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    ScrollView,
    Alert,
    Animated,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/Config/supabaseConfig';
import NotificationPreferences from '@/app/components/NotificationPreferences';

export default function SettingsScreen() {
    const router = useRouter();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [showNotificationPreferences, setShowNotificationPreferences] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Logout",
                    style: 'destructive',
                    onPress: async () => {
                        await supabase.auth.signOut();
                        router.replace('/auth/signIn');
                    }
                }
            ]
        );
    };

    const handleEditProfile = () => {
        // Navigate to the profile tab
        router.push('/(drawer)/(tabs)/profile');
    };

    const SettingItem = React.memo(({ icon, title, description, value, onValueChange, type = 'toggle' }) => {
        const scaleAnim = React.useRef(new Animated.Value(1)).current;

        const onPressIn = () => {
            Animated.spring(scaleAnim, {
                toValue: 0.98,
                friction: 5,
                tension: 40,
                useNativeDriver: true
            }).start();
        };

        const onPressOut = () => {
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                tension: 40,
                useNativeDriver: true
            }).start();
        };

        return (
            <TouchableOpacity
                activeOpacity={1}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => type === 'button' && onValueChange?.()}
            >
                <Animated.View style={[
                    styles.settingItem,
                    { transform: [{ scale: scaleAnim }] }
                ]}>
                    <View style={styles.settingIcon}>
                        <Ionicons name={icon} size={24} color="#075eec" />
                    </View>
                    <View style={styles.settingContent}>
                        <Text style={styles.settingTitle}>{title}</Text>
                        {description && (
                            <Text style={styles.settingDescription}>{description}</Text>
                        )}
                    </View>
                    {type === 'toggle' && (
                        <Switch
                            value={value}
                            onValueChange={onValueChange}
                            trackColor={{ false: '#E5E7EB', true: '#075eec' }}
                            thumbColor="#fff"
                        />
                    )}
                    {type === 'button' && (
                        <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                    )}
                </Animated.View>
            </TouchableOpacity>
        );
    });

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <SettingItem
                        icon="notifications-outline"
                        title="Notification Settings"
                        description="Manage your notification preferences"
                        type="button"
                        onValueChange={() => setShowNotificationPreferences(true)}
                    />
                    <SettingItem
                        icon="location-outline"
                        title="Location Services"
                        description="Enable location-based item discovery"
                        value={locationEnabled}
                        onValueChange={setLocationEnabled}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <SettingItem
                        icon="person-outline"
                        title="Edit Profile"
                        description="Update your personal information"
                        type="button"
                        onValueChange={handleEditProfile}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <SettingItem
                        icon="help-circle-outline"
                        title="Help Center"
                        description="Get help and contact support"
                        type="button"
                        onValueChange={() => Alert.alert('Help Center', 'Contact support at support@barterhaven.com')}
                    />
                    <SettingItem
                        icon="document-text-outline"
                        title="Terms of Service"
                        description="Read our terms and conditions"
                        type="button"
                        onValueChange={() => setShowTerms(true)}
                    />
                    <SettingItem
                        icon="shield-outline"
                        title="Privacy Policy"
                        description="View our privacy policy"
                        type="button"
                        onValueChange={() => setShowPrivacy(true)}
                    />
                </View>

                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>
            
            {/* Notification Preferences Modal */}
            <NotificationPreferences
                visible={showNotificationPreferences}
                onClose={() => setShowNotificationPreferences(false)}
            />
            {/* Terms of Service Modal */}
            <Modal
                visible={showTerms}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowTerms(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxHeight: '80%' }}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Terms of Service</Text>
                        <ScrollView style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 16, color: '#333' }}>
{`Welcome to BarterHaven! By using our app, you agree to the following:

- You are responsible for the items you list and trade.
- All trades are at your own risk; BarterHaven is not liable for losses or disputes.
- You agree not to post illegal, prohibited, or offensive content.
- You will treat other users respectfully and follow community guidelines.
- BarterHaven may update these terms at any time. Continued use means acceptance of changes.

For questions, contact support@barterhaven.com.`}
                            </Text>
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowTerms(false)} style={{ alignSelf: 'flex-end' }}>
                            <Ionicons name="close" size={28} color="#075eec" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* Privacy Policy Modal */}
            <Modal
                visible={showPrivacy}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowPrivacy(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxHeight: '80%' }}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>Privacy Policy</Text>
                        <ScrollView style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 16, color: '#333' }}>
{`We value your privacy. Here’s how we handle your data:

- We collect only the information needed to provide our services (e.g., email, location, trade details).
- Your data is never sold to third parties.
- You can request deletion of your account and data at any time.
- We use secure methods to store and transmit your information.
- For more details or requests, contact privacy@barterhaven.com.`}
                            </Text>
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowPrivacy(false)} style={{ alignSelf: 'flex-end' }}>
                            <Ionicons name="close" size={28} color="#075eec" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    content: {
        flex: 1,
        paddingTop: 16,
    },
    section: {
        marginTop: 24,
        marginHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#075eec',
        marginBottom: 16,
        fontFamily: 'outfit-bold',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EBF5FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
        fontFamily: 'outfit-bold',
    },
    settingDescription: {
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'outfit',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF1F0',
        marginHorizontal: 16,
        marginVertical: 24,
        padding: 16,
        borderRadius: 16,
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FF3B30',
        marginLeft: 8,
        fontFamily: 'outfit-bold',
    },
});
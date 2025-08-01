import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNotifications } from '@/context/NotificationContext';
import SimpleTimePicker from './SimpleTimePicker';

const NotificationPreferences = ({ visible, onClose }) => {
  const { preferences, updateNotificationPreferences, loading } = useNotifications();
  
  const [localPreferences, setLocalPreferences] = useState({
    messages: true,
    trades: true,
    matches: true,
    reminders: true,
    push_enabled: true,
    email_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00'
  });
  
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const handleToggle = (key) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleTimeChange = (timeString, isStart) => {
    setLocalPreferences(prev => ({
      ...prev,
      [isStart ? 'quiet_hours_start' : 'quiet_hours_end']: timeString
    }));
    
    // Close the time picker
    if (isStart) {
      setShowStartTimePicker(false);
    } else {
      setShowEndTimePicker(false);
    }
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateNotificationPreferences(localPreferences);
      Alert.alert('Success', 'Notification preferences updated successfully');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Preferences',
      'Are you sure you want to reset all notification preferences to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setLocalPreferences({
              messages: true,
              trades: true,
              matches: true,
              reminders: true,
              push_enabled: true,
              email_enabled: true,
              quiet_hours_start: '22:00',
              quiet_hours_end: '08:00'
            });
          }
        }
      ]
    );
  };

  const renderPreferenceItem = (key, title, description, icon) => (
    <View style={styles.preferenceItem}>
      <View style={styles.preferenceIcon}>
        <Ionicons name={icon} size={24} color="#075eec" />
      </View>
      <View style={styles.preferenceContent}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <Switch
        value={localPreferences[key]}
        onValueChange={() => handleToggle(key)}
        trackColor={{ false: '#767577', true: '#075eec' }}
        thumbColor={localPreferences[key] ? '#ffffff' : '#f4f3f4'}
      />
    </View>
  );

  const renderTimePickerItem = (title, description, timeKey, icon, isStart) => (
    <TouchableOpacity
      style={styles.preferenceItem}
      onPress={() => {
        if (isStart) {
          setShowStartTimePicker(true);
        } else {
          setShowEndTimePicker(true);
        }
      }}
    >
      <View style={styles.preferenceIcon}>
        <Ionicons name={icon} size={24} color="#075eec" />
      </View>
      <View style={styles.preferenceContent}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <View style={styles.timeDisplay}>
        <Text style={styles.timeText}>
          {formatTime(localPreferences[timeKey])}
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <LinearGradient
            colors={["#075eec", "#3B82F6"]}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Notification Settings</Text>
              <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                <Ionicons name="refresh" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.content}>
            {/* Push Notifications Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Push Notifications</Text>
              {renderPreferenceItem(
                'push_enabled',
                'Enable Push Notifications',
                'Receive notifications on your device',
                'notifications'
              )}
            </View>

            {/* Notification Types Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notification Types</Text>
              {renderPreferenceItem(
                'messages',
                'Messages',
                'New chat messages from other users',
                'chatbubble'
              )}
              {renderPreferenceItem(
                'trades',
                'Trade Updates',
                'Status changes on your trades',
                'swap-horizontal'
              )}
              {renderPreferenceItem(
                'matches',
                'Match Suggestions',
                'Potential matches for your items',
                'heart'
              )}
              {renderPreferenceItem(
                'reminders',
                'Trade Reminders',
                'Reminders about pending trades',
                'time'
              )}
            </View>

            {/* Email Notifications Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email Notifications</Text>
              {renderPreferenceItem(
                'email_enabled',
                'Email Notifications',
                'Receive important updates via email',
                'mail'
              )}
            </View>

            {/* Quiet Hours Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quiet Hours</Text>
              <Text style={styles.sectionDescription}>
                You won't receive push notifications during these hours
              </Text>
              
              {renderTimePickerItem(
                'Start Time',
                'When quiet hours begin',
                'quiet_hours_start',
                'moon',
                true
              )}
              
              {renderTimePickerItem(
                'End Time',
                'When quiet hours end',
                'quiet_hours_end',
                'sunny',
                false
              )}
            </View>

            {/* Privacy Notice */}
            <View style={styles.privacyNotice}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
              <Text style={styles.privacyText}>
                Your notification preferences are stored securely and never shared with third parties.
              </Text>
            </View>
          </ScrollView>

          {/* Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Time Pickers */}
          <SimpleTimePicker
            visible={showStartTimePicker}
            onClose={() => setShowStartTimePicker(false)}
            onTimeSelect={(time) => handleTimeChange(time, true)}
            initialTime={localPreferences.quiet_hours_start}
          />

          <SimpleTimePicker
            visible={showEndTimePicker}
            onClose={() => setShowEndTimePicker(false)}
            onTimeSelect={(time) => handleTimeChange(time, false)}
            initialTime={localPreferences.quiet_hours_end}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    overflow: 'hidden',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 5,
  },
  resetButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  preferenceContent: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#075eec',
    marginRight: 8,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f8f0',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  privacyText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#075eec',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#075eec',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default NotificationPreferences;
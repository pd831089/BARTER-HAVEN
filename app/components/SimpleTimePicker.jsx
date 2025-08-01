import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SimpleTimePicker = ({ visible, onClose, onTimeSelect, initialTime = '22:00' }) => {
  const [selectedHour, setSelectedHour] = useState(parseInt(initialTime.split(':')[0]));
  const [selectedMinute, setSelectedMinute] = useState(parseInt(initialTime.split(':')[1]));

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleConfirm = () => {
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`;
    onTimeSelect(timeString);
    onClose();
  };

  const renderPickerColumn = (data, selectedValue, onValueChange, label) => (
    <View style={styles.pickerColumn}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
        {data.map((value) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.pickerItem,
              selectedValue === value && styles.selectedPickerItem
            ]}
            onPress={() => onValueChange(value)}
          >
            <Text style={[
              styles.pickerItemText,
              selectedValue === value && styles.selectedPickerItemText
            ]}>
              {value.toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.title}>Select Time</Text>
            <TouchableOpacity onPress={handleConfirm}>
              <Ionicons name="checkmark" size={24} color="#075eec" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.selectedTimeDisplay}>
            <Text style={styles.selectedTimeText}>
              {selectedHour.toString().padStart(2, '0')}:{selectedMinute.toString().padStart(2, '0')}
            </Text>
          </View>
          
          <View style={styles.pickersContainer}>
            {renderPickerColumn(hours, selectedHour, setSelectedHour, 'Hour')}
            <View style={styles.separator}>
              <Text style={styles.separatorText}>:</Text>
            </View>
            {renderPickerColumn(minutes, selectedMinute, setSelectedMinute, 'Minute')}
          </View>
          
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '85%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  selectedTimeDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#f8f9ff',
  },
  selectedTimeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#075eec',
  },
  pickersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 10,
  },
  picker: {
    height: 150,
    width: '100%',
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginVertical: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedPickerItem: {
    backgroundColor: '#075eec',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  selectedPickerItemText: {
    color: 'white',
    fontWeight: '600',
  },
  separator: {
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  separatorText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#075eec',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#075eec',
    alignItems: 'center',
    marginLeft: 10,
  },
  confirmButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default SimpleTimePicker; 
import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';
import { useRouter } from 'expo-router';
import { TradesRefreshContext } from './_layout';
import { useAuth } from '@/Config/AuthContext';
import TradeManager from '@/app/components/TradeManager';

export default function TradesScreen() {
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'accepted', 'completed', 'disputed'
    const { user } = useAuth();
    const { trigger } = useContext(TradesRefreshContext);

    const tabs = [
        { key: 'all', label: 'All Trades', icon: 'swap-horizontal' },
        { key: 'pending', label: 'Pending', icon: 'clock-outline' },
        { key: 'accepted', label: 'Active', icon: 'checkmark-circle-outline' },
        { key: 'completed', label: 'Completed', icon: 'trophy-outline' },
        { key: 'disputed', label: 'Disputed', icon: 'alert-circle-outline' }
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Trades</Text>
                <Text style={styles.headerSubtitle}>Manage your barter transactions</Text>
            </View>
            
            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                <FlatList
                    data={tabs}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === item.key && styles.tabButtonActive]}
                            onPress={() => setActiveTab(item.key)}
                        >
                            <Ionicons
                                name={item.icon}
                                size={20}
                                color={activeTab === item.key ? '#3B82F6' : '#6B7280'}
                            />
                            <Text style={[styles.tabButtonText, activeTab === item.key && styles.tabButtonTextActive]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    )}
                    keyExtractor={item => item.key}
                />
            </View>

            {/* Trade Manager with Filter */}
            <View style={styles.content}>
                <TradeManager statusFilter={activeTab === 'all' ? null : activeTab} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        backgroundColor: '#fff',
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#075eec',
        fontFamily: 'outfit-bold',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
        fontFamily: 'outfit',
    },
    tabContainer: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tabList: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    tabButtonActive: {
        backgroundColor: '#EBF5FF',
        borderColor: '#3B82F6',
        borderWidth: 1,
    },
    tabButtonText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        fontFamily: 'outfit',
    },
    tabButtonTextActive: {
        color: '#3B82F6',
    },
    content: {
        flex: 1,
    },
}); 
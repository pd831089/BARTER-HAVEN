import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import LocationFilter from '@/app/components/LocationFilter';

export default function BrowseScreen({ navigation }) {
    const router = useRouter();
    const navigationHook = useNavigation();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [locationFilter, setLocationFilter] = useState({
        useLocationFilter: false,
        radius: null,
        userLocation: null,
    });

    useEffect(() => {
        fetchItems();
    }, [locationFilter]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            let itemsData = [];

            if (locationFilter.useLocationFilter && locationFilter.userLocation) {
                // Use location-based filtering (fallback to all items)
                console.warn('Location-based filtering not available - showing all items');
                const { data, error } = await supabase
                    .from('items')
                    .select('*, users:user_id(name, profile_image_url)')
                    .eq('status', 'available')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                itemsData = data || [];
            } else {
                // Fetch all available items
                const { data, error } = await supabase
                    .from('items')
                    .select('*, users:user_id(name, profile_image_url)')
                    .eq('status', 'available')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                itemsData = data || [];
            }

            setItems(itemsData);
        } catch (error) {
            console.error('Error fetching items:', error);
            Alert.alert('Error', 'Failed to load items');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (filterConfig) => {
        setLocationFilter(filterConfig);
    };

    const ItemCard = React.memo(({ item }) => {
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
                onPress={() => router.push(`/item/${item.id}`)}
            >
                <Animated.View style={[
                    styles.itemCard,
                    { transform: [{ scale: scaleAnim }] }
                ]}>
                    <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                    {/* Status Badge */}
                    <View style={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        backgroundColor: item.status === 'available' ? '#10B981'
                            : item.status === 'proposed' ? '#F59E0B'
                            : item.status === 'bartered' ? '#3B82F6'
                            : '#9CA3AF',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        zIndex: 3,
                        alignSelf: 'flex-start',
                    }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Text>
                    </View>
                    <View style={styles.itemInfo}>
                        <View style={styles.userInfo}>
                            {item.users?.profile_image_url ? (
                                <Image 
                                    source={{ uri: item.users.profile_image_url }} 
                                    style={styles.userAvatar}
                                />
                            ) : (
                                <View style={styles.defaultAvatar}>
                                    <Text style={styles.avatarText}>
                                        {item.users?.name?.[0]?.toUpperCase() || "?"}
                                    </Text>
                                </View>
                            )}
                            <Text style={styles.userName}>{item.users?.name || "User"}</Text>
                        </View>
                        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
                        <View style={styles.itemFooter}>
                            <View style={styles.categoryContainer}>
                                <Ionicons name="pricetag-outline" size={16} color="#075eec" />
                                <Text style={styles.itemCategory}>{item.category}</Text>
                            </View>
                            {item.distance_km && (
                                <View style={styles.distanceContainer}>
                                    <Ionicons name="location-outline" size={16} color="#10B981" />
                                    <Text style={styles.itemDistance}>
                                        {item.distance_km.toFixed(1)} km
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </Animated.View>
            </TouchableOpacity>
        );
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity
                        style={styles.drawerButton}
                        onPress={() => navigationHook.openDrawer()}
                    >
                        <Ionicons name="menu" size={24} color="#075eec" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Browse Items</Text>
                </View>
                <LocationFilter onFilterChange={handleFilterChange} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#075eec" />
                    <Text style={styles.loadingText}>Loading items...</Text>
                </View>
            ) : (
                <FlatList
                    data={items}
                    renderItem={({ item }) => <ItemCard item={item} />}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.itemsList}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search" size={64} color="#075eec" />
                            <Text style={styles.emptyTitle}>No items found</Text>
                            <Text style={styles.emptyDescription}>
                                {locationFilter.useLocationFilter 
                                    ? 'Try adjusting your location filter or expanding the search radius.'
                                    : 'There are no items available at the moment.'}
                            </Text>
                        </View>
                    }
                />
            )}
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
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    drawerButton: {
        padding: 4,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#075eec',
        fontFamily: 'outfit-bold',
    },
    itemsList: {
        padding: 16,
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        overflow: 'hidden',
    },
    itemImage: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
    },
    itemInfo: {
        padding: 16,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    userAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 2,
        borderColor: '#075eec',
    },
    defaultAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
        backgroundColor: '#075eec',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#075eec',
        fontFamily: 'outfit',
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
        fontFamily: 'outfit-bold',
    },
    itemDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
        fontFamily: 'outfit',
    },
    itemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EBF5FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    itemCategory: {
        fontSize: 12,
        color: '#075eec',
        fontWeight: '500',
        marginLeft: 4,
        textTransform: 'uppercase',
        fontFamily: 'outfit',
    },
    distanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    itemDistance: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '500',
        marginLeft: 4,
        fontFamily: 'outfit',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#075eec',
        fontFamily: 'outfit',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#075eec',
        marginTop: 16,
        marginBottom: 8,
        fontFamily: 'outfit-bold',
    },
    emptyDescription: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: 32,
        fontFamily: 'outfit',
    },
}); 
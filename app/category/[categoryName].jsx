import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { 
    View, 
    Text, 
    FlatList, 
    Image, 
    StyleSheet, 
    ActivityIndicator, 
    TouchableOpacity,
    Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';

const { width } = Dimensions.get('window');

export default function CategoryScreen() {
    const { categoryName } = useLocalSearchParams();
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const { data, error } = await supabase
                    .from('items')
                    .select('*, users:user_id(name, profile_image_url)')
                    .eq('category', categoryName)
                    .eq('status', 'available')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                setItems(data || []);
            } catch (error) {
                console.error('Error fetching items:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchItems();
    }, [categoryName]);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.itemCard}
            onPress={() => router.push(`/item/${item.id}`)}
            activeOpacity={0.7}
        >
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
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.itemDescription} numberOfLines={2}>
                    {item.description}
                </Text>
                <View style={styles.itemFooter}>
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
                    <Ionicons name="chevron-forward" size={20} color="#075eec" />
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#075eec" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{categoryName}</Text>
                <View style={styles.placeholder} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#075eec" />
                    <Text style={styles.loadingText}>Loading items...</Text>
                </View>
            ) : (
                <FlatList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search" size={64} color="#075eec" />
                            <Text style={styles.emptyTitle}>No items found</Text>
                            <Text style={styles.emptyDescription}>
                                There are no items available in the {categoryName} category.
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#075eec',
        fontFamily: 'outfit-bold',
    },
    placeholder: {
        width: 32,
    },
    listContainer: {
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
    itemTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8,
        fontFamily: 'outfit-bold',
    },
    itemDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
        fontFamily: 'outfit',
        lineHeight: 20,
    },
    itemFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
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
        fontWeight: '500',
        color: '#075eec',
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
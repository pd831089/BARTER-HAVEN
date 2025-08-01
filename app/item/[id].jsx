import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView, Dimensions, TouchableOpacity, Modal, TextInput, Alert, Linking, TouchableWithoutFeedback } from 'react-native';
import { supabase } from '@/Config/supabaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/Config/AuthContext';
import ItemMatches from '../components/ItemMatches';
import ItemLocation from '../components/ItemLocation';

const { width } = Dimensions.get('window');

export default function ItemDetails() {
    const { id } = useLocalSearchParams();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showProposeModal, setShowProposeModal] = useState(false);
    const [proposedItemDescription, setProposedItemDescription] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [billDocument, setBillDocument] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const { user } = useAuth();
    const [showManualBarterModal, setShowManualBarterModal] = useState(false);
    const [userItems, setUserItems] = useState([]);
    const [selectedUserItemId, setSelectedUserItemId] = useState(null);
    const [manualMessage, setManualMessage] = useState('');
    const [manualExchangeMode, setManualExchangeMode] = useState('online');
    const [ratings, setRatings] = useState([]);
    const [averageRating, setAverageRating] = useState(0);
    const [userRating, setUserRating] = useState(null);
    const [ratingSubmitting, setRatingSubmitting] = useState(false);

    useEffect(() => {
        const fetchItem = async () => {
            try {
                // Fetch item details with user info
                const { data: itemData, error: itemError } = await supabase
                    .from('items')
                    .select('*, users(*)')
                    .eq('id', id)
                    .single();
                
                if (itemError) throw itemError;

                // Fetch bill document if it exists
                const { data: billData, error: billError } = await supabase
                    .from('bill_documents')
                    .select('*')
                    .eq('item_id', id)
                    .maybeSingle();

                if (billError) throw billError;

                setItem(itemData);
                setBillDocument(billData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching item details:', error);
                setLoading(false);
            }
        };

        const fetchRatings = async () => {
            if (!id) return;
            const { data, error } = await supabase
                .from('ratings')
                .select('*')
                .eq('product_id', id);
            if (!error && data) {
                setRatings(data);
                if (data.length > 0) {
                    const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
                    setAverageRating(avg);
                } else {
                    setAverageRating(0);
                }
                if (user) {
                    const userR = data.find(r => r.user_id === user.id);
                    setUserRating(userR ? userR.rating : null);
                }
            }
        };

        const fetchUserLocation = async () => {
            if (user) {
                try {
                    // Fallback: Get user location from Supabase directly
                    const { data: locationData, error } = await supabase
                        .from('users')
                        .select(`
                            latitude,
                            longitude,
                            address_street,
                            address_city,
                            address_region,
                            address_postal_code,
                            address_country,
                            location
                        `)
                        .eq('id', user.id)
                        .single();

                    if (!error && locationData?.latitude && locationData?.longitude) {
                        setUserLocation({
                            latitude: locationData.latitude,
                            longitude: locationData.longitude,
                            address: {
                                street: locationData.address_street || '',
                                city: locationData.address_city || '',
                                region: locationData.address_region || '',
                                postalCode: locationData.address_postal_code || '',
                                country: locationData.address_country || '',
                                fullAddress: locationData.location || '',
                            },
                        });
                    }
                } catch (error) {
                    console.error('Error fetching user location:', error);
                }
            }
        };

        if (id) {
            fetchItem();
            fetchUserLocation();
            fetchRatings();
        }
        // Refetch ratings when user changes (login/logout)
    }, [id, user]);

    // Fetch user's own items for manual barter
    useEffect(() => {
        if (user && showManualBarterModal) {
            supabase
                .from('items')
                .select('id, title, description')
                .eq('user_id', user.id)
                .eq('status', 'available')
                .then(({ data, error }) => {
                    if (!error) setUserItems(data || []);
                });
        }
    }, [user, showManualBarterModal]);

    const handleProposeTrade = async (matchedItemId) => {
        if (!user) {
            Alert.alert('Error', 'Please sign in to propose a trade');
            return;
        }

        if (user.id === item.user_id) {
            Alert.alert('Error', 'You cannot propose a trade on your own item');
            return;
        }

        // Check if user already has a pending proposal
        const { data: existingProposals, error: checkError } = await supabase
            .from('trade_proposals')
            .select('id')
            .eq('item_id', id)
            .eq('proposer_id', user.id)
            .eq('status', 'pending');

        if (checkError) {
            console.error('Error checking existing proposals:', checkError);
            Alert.alert('Error', 'Failed to check existing proposals');
            return;
        }

        if (existingProposals && existingProposals.length > 0) {
            Alert.alert(
                'Already Proposed',
                'You already have a pending trade proposal for this item.',
                [{ text: 'OK' }]
            );
            return;
        }

        // Get matched item details
        const { data: matchedItem, error: matchedItemError } = await supabase
            .from('items')
            .select('title, description')
            .eq('id', matchedItemId)
            .single();

        if (matchedItemError) {
            console.error('Error fetching matched item:', matchedItemError);
            Alert.alert('Error', 'Failed to fetch matched item details');
            return;
        }

        // Create the trade proposal
        const { error } = await supabase
            .from('trade_proposals')
            .insert([
                {
                    item_id: id,
                    proposer_id: user.id,
                    proposed_item_description: `Offering: ${matchedItem.title}\n${matchedItem.description || ''}`,
                    status: 'pending'
                }
            ]);

        if (error) {
            console.error('Error creating proposal:', error);
            Alert.alert('Error', 'Failed to create trade proposal');
            return;
        }

        Alert.alert('Success', 'Trade proposal sent successfully');
    };

    const handleDeleteBill = async () => {
        if (!user || user.id !== item.user_id) return;

        Alert.alert(
            'Delete Bill Document',
            'Are you sure you want to delete this bill document?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('bill_documents')
                                .delete()
                                .eq('item_id', id);

                            if (error) throw error;

                            setBillDocument(null);
                            Alert.alert('Success', 'Bill document deleted successfully');
                        } catch (error) {
                            console.error('Error deleting bill:', error);
                            Alert.alert('Error', 'Failed to delete bill document');
                        }
                    }
                }
            ]
        );
    };

    const handleManualBarter = async () => {
        if (!user) {
            Alert.alert('Error', 'Please sign in to propose a trade');
            return;
        }
        if (user.id === item.user_id) {
            Alert.alert('Error', 'You cannot propose a trade on your own item');
            return;
        }
        if (!selectedUserItemId) {
            Alert.alert('Error', 'Please select one of your items to offer');
            return;
        }
        // Check for existing pending proposal
        const { data: existingProposals, error: checkError } = await supabase
            .from('trade_proposals')
            .select('id')
            .eq('item_id', id)
            .eq('proposer_id', user.id)
            .eq('status', 'pending');
        if (checkError) {
            Alert.alert('Error', 'Failed to check existing proposals');
            return;
        }
        if (existingProposals && existingProposals.length > 0) {
            Alert.alert('Already Proposed', 'You already have a pending trade proposal for this item.');
            return;
        }
        // Get selected item details
        const { data: offeredItem, error: offeredItemError } = await supabase
            .from('items')
            .select('title, description')
            .eq('id', selectedUserItemId)
            .single();
        if (offeredItemError) {
            Alert.alert('Error', 'Failed to fetch your item details');
            return;
        }
        // Create the trade proposal
        const { error } = await supabase
            .from('trade_proposals')
            .insert([
                {
                    item_id: id,
                    proposer_id: user.id,
                    proposed_item_description: `Offering: ${offeredItem.title}\n${offeredItem.description || ''}`,
                    message: manualMessage,
                    status: 'pending',
                    exchange_mode: manualExchangeMode,
                }
            ]);
        if (error) {
            Alert.alert('Error', 'Failed to create trade proposal');
            return;
        }
        setShowManualBarterModal(false);
        setSelectedUserItemId(null);
        setManualMessage('');
        setManualExchangeMode('online');
        Alert.alert('Success', 'Trade proposal sent successfully');
    };

    // Helper to render stars
    const renderStars = (rating, size = 22, color = '#FBBF24') => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Ionicons
                    key={i}
                    name={i <= Math.round(rating) ? 'star' : 'star-outline'}
                    size={size}
                    color={color}
                />
            );
        }
        return stars;
    };

    // Handle user rating
    const handleRate = async (ratingValue) => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in to rate this product.');
            return;
        }
        setRatingSubmitting(true);
        try {
            // Upsert rating (insert or update)
            const { error } = await supabase
                .from('ratings')
                .upsert({
                    user_id: user.id,
                    product_id: id,
                    rating: ratingValue,
                    updated_at: new Date().toISOString(),
                }, { onConflict: ['user_id', 'product_id'] });
            if (error) throw error;
            setUserRating(ratingValue);
            // Refetch ratings to update average
            const { data, error: fetchError } = await supabase
                .from('ratings')
                .select('*')
                .eq('product_id', id);
            if (!fetchError && data) {
                setRatings(data);
                if (data.length > 0) {
                    const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
                    setAverageRating(avg);
                } else {
                    setAverageRating(0);
                }
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to submit rating.');
        } finally {
            setRatingSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}><ActivityIndicator size="large" color="#075eec" /></View>
        );
    }

    if (!item) {
        return (
            <View style={styles.centered}><Text>Item not found.</Text></View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.bg}>
            <View style={styles.card}>
                <Image source={{ uri: item.image_url }} style={styles.image} />
                
                <View style={styles.content}>
                    {/* Status Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{
                            backgroundColor: item.status === 'available' ? '#10B981'
                                : item.status === 'proposed' ? '#F59E0B'
                                : item.status === 'bartered' ? '#3B82F6'
                                : '#9CA3AF',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 8,
                            marginRight: 8
                        }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                        </View>
                    </View>
                    {/* Product Rating Display */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        {renderStars(averageRating, 22)}
                        <Text style={{ marginLeft: 8, color: '#FBBF24', fontWeight: 'bold', fontSize: 16 }}>
                            {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'}
                        </Text>
                        {ratings.length > 0 && (
                            <Text style={{ marginLeft: 6, color: '#6B7280', fontSize: 14 }}>({ratings.length})</Text>
                        )}
                    </View>
                    {/* User Rating Input */}
                    {user && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ marginRight: 8, color: '#374151', fontSize: 15 }}>Your Rating:</Text>
                            {[1,2,3,4,5].map(i => (
                                <TouchableWithoutFeedback key={i} onPress={() => handleRate(i)} disabled={ratingSubmitting}>
                                    <View>
                                        <Ionicons
                                            name={i <= (userRating || 0) ? 'star' : 'star-outline'}
                                            size={26}
                                            color={i <= (userRating || 0) ? '#FBBF24' : '#D1D5DB'}
                                        />
                                    </View>
                                </TouchableWithoutFeedback>
                            ))}
                            {ratingSubmitting && <ActivityIndicator size="small" color="#FBBF24" style={{ marginLeft: 8 }} />}
                        </View>
                    )}
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                    
                    {/* Manual Barter Button */}
                    <TouchableOpacity
                        style={{ backgroundColor: '#2563EB', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' }}
                        onPress={() => setShowManualBarterModal(true)}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Manual Barter</Text>
                    </TouchableOpacity>

                    {/* Manual Barter Modal */}
                    <Modal
                        visible={showManualBarterModal}
                        animationType="slide"
                        transparent={true}
                        onRequestClose={() => setShowManualBarterModal(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '90%' }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Propose Manual Barter</Text>
                                <Text style={{ marginBottom: 8 }}>Select one of your items to offer:</Text>
                                <ScrollView style={{ maxHeight: 120, marginBottom: 8 }}>
                                    {userItems.length === 0 ? (
                                        <Text style={{ color: '#888' }}>No available items found.</Text>
                                    ) : (
                                        userItems.map((userItem) => (
                                            <TouchableOpacity
                                                key={userItem.id}
                                                style={{
                                                    padding: 10,
                                                    backgroundColor: selectedUserItemId === userItem.id ? '#DBEAFE' : '#F3F4F6',
                                                    borderRadius: 6,
                                                    marginBottom: 6,
                                                }}
                                                onPress={() => setSelectedUserItemId(userItem.id)}
                                            >
                                                <Text style={{ fontWeight: '600' }}>{userItem.title}</Text>
                                                <Text style={{ color: '#666' }}>{userItem.description}</Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </ScrollView>
                                <Text style={{ marginTop: 8 }}>Message (optional):</Text>
                                <TextInput
                                    value={manualMessage}
                                    onChangeText={setManualMessage}
                                    placeholder="Add a message..."
                                    style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 8, marginBottom: 8, marginTop: 4 }}
                                    multiline
                                />
                                <Text style={{ marginTop: 8 }}>Exchange Mode:</Text>
                                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1,
                                            backgroundColor: manualExchangeMode === 'online' ? '#2563EB' : '#E5E7EB',
                                            padding: 10,
                                            borderRadius: 6,
                                            marginRight: 4,
                                            alignItems: 'center',
                                        }}
                                        onPress={() => setManualExchangeMode('online')}
                                    >
                                        <Text style={{ color: manualExchangeMode === 'online' ? '#fff' : '#111' }}>Online</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{
                                            flex: 1,
                                            backgroundColor: manualExchangeMode === 'in_person' ? '#2563EB' : '#E5E7EB',
                                            padding: 10,
                                            borderRadius: 6,
                                            marginLeft: 4,
                                            alignItems: 'center',
                                        }}
                                        onPress={() => setManualExchangeMode('in_person')}
                                    >
                                        <Text style={{ color: manualExchangeMode === 'in_person' ? '#fff' : '#111' }}>In Person</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                                    <TouchableOpacity
                                        style={{
                                            marginRight: 12,
                                            backgroundColor: '#EF4444',
                                            paddingVertical: 10,
                                            paddingHorizontal: 18,
                                            borderRadius: 6,
                                            shadowColor: '#EF4444',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.2,
                                            shadowRadius: 4,
                                            elevation: 2,
                                            alignItems: 'center',
                                        }}
                                        onPress={() => setShowManualBarterModal(false)}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#2563EB', padding: 10, borderRadius: 6 }}
                                        onPress={handleManualBarter}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Send Proposal</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    <View style={styles.details}>
                        <View style={styles.detailRow}>
                            <Ionicons name="pricetag" size={16} color="#6B7280" />
                            <Text style={styles.detailText}>Category: {item.category}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Ionicons name="checkmark-circle" size={16} color="#6B7280" />
                            <Text style={styles.detailText}>Condition: {item.condition}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Ionicons name="swap-horizontal" size={16} color="#6B7280" />
                            <Text style={styles.detailText}>Barter Type: {item.bartertype}</Text>
                        </View>
                    </View>

                    <ItemLocation item={item} userLocation={userLocation} />
                    
                    <View style={styles.userInfo}>
                        <Image 
                            source={{ uri: item.users?.profile_image_url || require('../../assets/images/default-profile.png') }} 
                            style={styles.userImage} 
                        />
                        <View style={styles.userDetails}>
                            <Text style={styles.userName}>{item.users?.name || 'Unknown User'}</Text>
                            <Text style={styles.userRating}>⭐ 5.0 (10 reviews)</Text>
                        </View>
                    </View>

                    {billDocument && (
                        <View style={styles.billSection}>
                            <Text style={styles.billTitle}>Bill Document</Text>
                            <View style={styles.billInfo}>
                                <Ionicons name="document" size={20} color="#3B82F6" />
                                <Text style={styles.billText}>Bill document available</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (billDocument?.document_url) {
                                            Linking.openURL(billDocument.document_url);
                                        } else {
                                            Alert.alert('Error', 'No bill document URL found.');
                                        }
                                    }}
                                    style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}
                                >
                                    <Ionicons name="eye" size={20} color="#2563EB" />
                                    <Text style={{ color: '#2563EB', marginLeft: 4 }}>View Bill</Text>
                                </TouchableOpacity>
                                {user && user.id === item.user_id && (
                                    <TouchableOpacity onPress={handleDeleteBill}>
                                        <Ionicons name="trash" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}

                    <ItemMatches itemId={id} onProposeTrade={handleProposeTrade} />
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    bg: {
        backgroundColor: '#F3F4F6',
        minHeight: '100%',
    },
    card: {
        backgroundColor: '#fff',
        margin: 16,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    image: {
        width: '100%',
        height: 300,
        resizeMode: 'cover',
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 24,
    },
    details: {
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#374151',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 16,
    },
    userImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    userRating: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    billSection: {
        marginBottom: 16,
    },
    billTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    billInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    billText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#1E40AF',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
}); 
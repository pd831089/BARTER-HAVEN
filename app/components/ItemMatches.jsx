import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Switch,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '@/Config/supabaseConfig';
import { useRouter } from 'expo-router';
import { useAuth } from '@/Config/AuthContext';

export default function ItemMatches({ itemId, onProposeTrade }) {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savedMatches, setSavedMatches] = useState(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        minScore: 0.3,
        maxDistance: 100,
        condition: ['new', 'like_new', 'good', 'fair', 'poor'],
        showSavedOnly: false,
    });
    const [showMatchDetails, setShowMatchDetails] = useState(null);
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        if (itemId && user) {
            fetchMatches();
            fetchSavedMatches();
        }
    }, [itemId, user, filters]);

    const fetchSavedMatches = async () => {
        try {
            const { data, error } = await supabase
                .from('saved_matches')
                .select('matched_item_id')
                .eq('user_id', user.id)
                .eq('item_id', itemId);

            if (error) throw error;
            setSavedMatches(new Set(data.map(m => m.matched_item_id)));
        } catch (error) {
            console.error('Error fetching saved matches:', error);
        }
    };

    const fetchMatches = async () => {
        try {
            const { data, error } = await supabase
                .rpc('find_potential_matches', {
                    p_item_id: itemId,
                    p_min_score: filters.minScore,
                    p_limit: 50
                });

            if (error) throw error;

            // Apply client-side filters
            let filteredData = data.filter(match => {
                if (filters.maxDistance && match.distance_km > filters.maxDistance) return false;
                if (!filters.condition.includes(match.condition)) return false;
                if (filters.showSavedOnly && !savedMatches.has(match.matched_item_id)) return false;
                return true;
            });

            setMatches(filteredData || []);
        } catch (error) {
            console.error('Error fetching matches:', error);
            Alert.alert('Error', 'Failed to load potential matches');
        } finally {
            setLoading(false);
        }
    };

    const toggleSaveMatch = async (matchedItemId) => {
        try {
            if (savedMatches.has(matchedItemId)) {
                await supabase
                    .from('saved_matches')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('item_id', itemId)
                    .eq('matched_item_id', matchedItemId);
                savedMatches.delete(matchedItemId);
            } else {
                await supabase
                    .from('saved_matches')
                    .insert({
                        user_id: user.id,
                        item_id: itemId,
                        matched_item_id: matchedItemId
                    });
                savedMatches.add(matchedItemId);
            }
            setSavedMatches(new Set(savedMatches));
        } catch (error) {
            console.error('Error toggling saved match:', error);
            Alert.alert('Error', 'Failed to save/unsave match');
        }
    };

    const renderMatchReasons = (reasons) => {
        return (
            <View style={styles.reasonsContainer}>
                {Object.entries(reasons).map(([key, value]) => (
                    <View key={key} style={styles.reasonItem}>
                        <MaterialCommunityIcons
                            name={getReasonIcon(key)}
                            size={16}
                            color="#075eec"
                        />
                        <Text style={styles.reasonText}>{value}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const getReasonIcon = (reason) => {
        switch (reason) {
            case 'category': return 'shape';
            case 'tags': return 'tag-multiple';
            case 'value': return 'currency-usd';
            case 'location': return 'map-marker';
            case 'condition': return 'star';
            case 'popularity': return 'trending-up';
            case 'age': return 'clock';
            case 'preference': return 'heart';
            default: return 'information';
        }
    };

    const renderMatchScore = (score, reasons) => {
        const percentage = Math.round(score * 100);
        const bars = Math.round(score * 5);
        return (
            <TouchableOpacity
                style={styles.matchScoreContainer}
                onPress={() => setShowMatchDetails(reasons)}
            >
                <Text style={styles.matchPercentage}>{percentage}% Match</Text>
                <View style={styles.matchBars}>
                    {[...Array(5)].map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.matchBar,
                                { backgroundColor: i < bars ? '#075eec' : '#e1e1e1' }
                            ]}
                        />
                    ))}
                </View>
                <Text style={styles.tapForMore}>Tap for details</Text>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.matchItem}>
            <TouchableOpacity
                style={styles.itemContent}
                onPress={() => router.push(`/item/${item.matched_item_id}`)}
            >
                <Image
                    source={{ uri: item.item_image_url }}
                    style={styles.itemImage}
                    defaultSource={require('@/assets/images/placeholder.jpg')}
                />
                <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.item_title}</Text>
                    <Text style={styles.ownerName}>by {item.owner_name}</Text>
                    {item.estimated_value && (
                        <Text style={styles.estimatedValue}>
                            Est. Value: ${item.estimated_value.toFixed(2)}
                        </Text>
                    )}
                    {item.distance_km && (
                        <Text style={styles.distance}>
                            {Math.round(item.distance_km)}km away
                        </Text>
                    )}
                    {renderMatchScore(item.match_score, item.match_reasons)}
                </View>
            </TouchableOpacity>
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => toggleSaveMatch(item.matched_item_id)}
                >
                    <MaterialCommunityIcons
                        name={savedMatches.has(item.matched_item_id) ? 'heart' : 'heart-outline'}
                        size={24}
                        color={savedMatches.has(item.matched_item_id) ? '#ff4b4b' : '#666'}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.proposeButton}
                    onPress={() => onProposeTrade(item.matched_item_id)}
                >
                    <MaterialCommunityIcons name="swap-horizontal" size={24} color="#fff" />
                    <Text style={styles.proposeButtonText}>Propose</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderFilters = () => (
        <Modal
            visible={showFilters}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowFilters(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Filter Matches</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowFilters(false)}
                        >
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.filtersList}>
                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Minimum Match Score</Text>
                            <View style={styles.scoreSelector}>
                                {[0.3, 0.4, 0.5, 0.6, 0.7].map(score => (
                                    <TouchableOpacity
                                        key={score}
                                        style={[
                                            styles.scoreOption,
                                            filters.minScore === score && styles.scoreOptionSelected
                                        ]}
                                        onPress={() => setFilters({ ...filters, minScore: score })}
                                    >
                                        <Text style={[
                                            styles.scoreOptionText,
                                            filters.minScore === score && styles.scoreOptionTextSelected
                                        ]}>
                                            {Math.round(score * 100)}%
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Maximum Distance</Text>
                            <View style={styles.distanceSelector}>
                                {[10, 20, 50, 100].map(distance => (
                                    <TouchableOpacity
                                        key={distance}
                                        style={[
                                            styles.distanceOption,
                                            filters.maxDistance === distance && styles.distanceOptionSelected
                                        ]}
                                        onPress={() => setFilters({ ...filters, maxDistance: distance })}
                                    >
                                        <Text style={[
                                            styles.distanceOptionText,
                                            filters.maxDistance === distance && styles.distanceOptionTextSelected
                                        ]}>
                                            {distance}km
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Item Condition</Text>
                            <View style={styles.conditionSelector}>
                                {['new', 'like_new', 'good', 'fair', 'poor'].map(condition => (
                                    <TouchableOpacity
                                        key={condition}
                                        style={[
                                            styles.conditionOption,
                                            filters.condition.includes(condition) && styles.conditionOptionSelected
                                        ]}
                                        onPress={() => {
                                            const newConditions = filters.condition.includes(condition)
                                                ? filters.condition.filter(c => c !== condition)
                                                : [...filters.condition, condition];
                                            setFilters({ ...filters, condition: newConditions });
                                        }}
                                    >
                                        <Text style={[
                                            styles.conditionOptionText,
                                            filters.condition.includes(condition) && styles.conditionOptionTextSelected
                                        ]}>
                                            {condition.replace('_', ' ')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.filterSection}>
                            <View style={styles.switchContainer}>
                                <Text style={styles.filterLabel}>Show Saved Matches Only</Text>
                                <Switch
                                    value={filters.showSavedOnly}
                                    onValueChange={(value) => setFilters({ ...filters, showSavedOnly: value })}
                                    trackColor={{ false: '#e1e1e1', true: '#075eec' }}
                                />
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.applyButton}
                        onPress={() => setShowFilters(false)}
                    >
                        <Text style={styles.applyButtonText}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    const renderMatchDetailsModal = () => (
        <Modal
            visible={!!showMatchDetails}
            animationType="fade"
            transparent={true}
            onRequestClose={() => setShowMatchDetails(null)}
        >
            <TouchableOpacity
                style={styles.modalContainer}
                activeOpacity={1}
                onPress={() => setShowMatchDetails(null)}
            >
                <View style={styles.matchDetailsContent}>
                    <Text style={styles.matchDetailsTitle}>Why these items match?</Text>
                    {showMatchDetails && renderMatchReasons(showMatchDetails)}
                </View>
            </TouchableOpacity>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#075eec" />
            </View>
        );
    }

    if (!matches.length) {
        return (
            <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="swap-horizontal" size={48} color="#666" />
                <Text style={styles.emptyText}>No potential matches found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Potential Matches</Text>
                <TouchableOpacity
                    style={styles.filterButton}
                    onPress={() => setShowFilters(true)}
                >
                    <MaterialCommunityIcons name="filter-variant" size={24} color="#075eec" />
                </TouchableOpacity>
            </View>
            <FlatList
                data={matches}
                renderItem={renderItem}
                keyExtractor={(item) => item.matched_item_id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
            {renderFilters()}
            {renderMatchDetailsModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    filterButton: {
        padding: 8,
    },
    matchItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    itemContent: {
        flexDirection: 'row',
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    ownerName: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    estimatedValue: {
        fontSize: 14,
        color: '#075eec',
        marginBottom: 4,
    },
    distance: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    matchScoreContainer: {
        marginTop: 4,
    },
    matchPercentage: {
        fontSize: 14,
        fontWeight: '600',
        color: '#075eec',
        marginBottom: 4,
    },
    matchBars: {
        flexDirection: 'row',
        gap: 4,
    },
    matchBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    tapForMore: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    saveButton: {
        padding: 8,
        marginRight: 12,
    },
    proposeButton: {
        backgroundColor: '#075eec',
        borderRadius: 8,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    proposeButtonText: {
        color: '#fff',
        fontSize: 14,
        marginLeft: 4,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 8,
    },
    filtersList: {
        marginBottom: 16,
    },
    filterSection: {
        marginBottom: 20,
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    scoreSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    scoreOption: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        minWidth: 60,
        alignItems: 'center',
    },
    scoreOptionSelected: {
        backgroundColor: '#075eec',
    },
    scoreOptionText: {
        color: '#666',
    },
    scoreOptionTextSelected: {
        color: '#fff',
    },
    distanceSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    distanceOption: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        minWidth: 70,
        alignItems: 'center',
    },
    distanceOptionSelected: {
        backgroundColor: '#075eec',
    },
    distanceOptionText: {
        color: '#666',
    },
    distanceOptionTextSelected: {
        color: '#fff',
    },
    conditionSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    conditionOption: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        minWidth: 80,
        alignItems: 'center',
    },
    conditionOptionSelected: {
        backgroundColor: '#075eec',
    },
    conditionOptionText: {
        color: '#666',
        textTransform: 'capitalize',
    },
    conditionOptionTextSelected: {
        color: '#fff',
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    applyButton: {
        backgroundColor: '#075eec',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    applyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    matchDetailsContent: {
        backgroundColor: '#fff',
        margin: 32,
        padding: 16,
        borderRadius: 12,
        alignSelf: 'center',
    },
    matchDetailsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
        textAlign: 'center',
    },
    reasonsContainer: {
        gap: 8,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    reasonText: {
        fontSize: 14,
        color: '#333',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginTop: 12,
    },
    listContent: {
        paddingBottom: 16,
    },
}); 
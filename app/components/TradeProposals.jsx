import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '@/Config/supabaseConfig';
import { useAuth } from '@/Config/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TradesRefreshContext } from '../(drawer)/_layout';

export default function TradeProposals() {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [itemTitles, setItemTitles] = useState({}); // Cache for missing item titles
    const { user } = useAuth();
    const router = useRouter();
    const { refresh } = useContext(TradesRefreshContext);

    useEffect(() => {
        const fetchProposals = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.id) {
                setProposals({ incoming: [], outgoing: [] });
                setLoading(false);
                return;
            }
            try {
                const { data: sentProposals, error: sentError } = await supabase
                    .from('trade_proposals')
                    .select('*, items:item_id(id, title, image_url, user_id)')
                    .eq('proposer_id', user.id)
                    .order('created_at', { ascending: false });
                if (sentError) throw sentError;
                const { data: receivedProposals, error: receivedError } = await supabase
                    .from('trade_proposals')
                    .select('*, items:item_id(id, title, image_url, user_id)')
                    .eq('items.user_id', user.id)
                    .order('created_at', { ascending: false });
                if (receivedError) throw receivedError;
                const uniqueProposals = new Map();
                (sentProposals || []).forEach(proposal => {
                    uniqueProposals.set(proposal.id, { ...proposal, type: 'sent' });
                });
                (receivedProposals || []).forEach(proposal => {
                    uniqueProposals.set(proposal.id, { ...proposal, type: 'received' });
                });
                const allProposals = Array.from(uniqueProposals.values());
                setProposals(allProposals);
                // Fetch missing item titles and images
                const missing = allProposals.filter(p => !p.items && p.item_id && !itemTitles[p.item_id]);
                if (missing.length > 0) {
                    const ids = missing.map(p => p.item_id);
                    const { data: itemsData } = await supabase
                        .from('items')
                        .select('id, title, image_url, user_id')
                        .in('id', ids);
                    if (itemsData) {
                        const newTitles = { ...itemTitles };
                        itemsData.forEach(item => {
                            newTitles[item.id] = { title: item.title, image_url: item.image_url, user_id: item.user_id };
                        });
                        setItemTitles(newTitles);
                    }
                }
            } catch (error) {
                console.error('Error fetching proposals:', error);
                Alert.alert('Error', 'Failed to load trade proposals');
            } finally {
                setLoading(false);
            }
        };
        fetchProposals();
    }, []);

    const handleProposalAction = async (proposalId, action) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('trade_proposals')
                .update({
                    status: action,
                    updated_at: new Date().toISOString()
                })
                .eq('id', proposalId);
            if (error) throw error;
            let tradeCreated = false;
            if (action === 'accepted') {
                const proposal = proposals.find(p => p.id === proposalId);
                if (proposal) {
                    // Cancel other pending proposals for this item
                    await supabase
                        .from('trade_proposals')
                        .update({
                            status: 'cancelled',
                            updated_at: new Date().toISOString()
                        })
                        .eq('item_id', proposal.item_id)
                        .neq('id', proposalId)
                        .eq('status', 'pending');

                    // Ensure all required fields for trade creation
                    const proposer_id = proposal.proposer_id;
                    const receiver_id = proposal.items?.user_id;
                    const requested_item_id = proposal.item_id;
                    let offered_item_id = proposal.proposed_item_id || null;
                    console.log('[TradeProposals] Trade creation fields:', { proposer_id, receiver_id, requested_item_id, offered_item_id, proposal });
                    if (!proposer_id || !receiver_id || !requested_item_id) {
                        Alert.alert('Error', 'Missing required fields for trade creation. Please contact support.');
                        console.error('[TradeProposals] Missing required fields for trade creation:', { proposer_id, receiver_id, requested_item_id, offered_item_id, proposal });
                        return;
                    }
                    // Check if a trade already exists for this proposal
                    const { data: existingTrades, error: tradeFetchError } = await supabase
                        .from('trades')
                        .select('id')
                        .eq('offered_item_id', offered_item_id)
                        .eq('requested_item_id', requested_item_id)
                        .eq('proposer_id', proposer_id)
                        .eq('receiver_id', receiver_id);
                    if (tradeFetchError) {
                        console.error('[TradeProposals] Trade fetch error:', tradeFetchError);
                        Alert.alert('Error', 'Failed to check for existing trades: ' + tradeFetchError.message);
                        return;
                    }
                    if (!existingTrades || existingTrades.length === 0) {
                        // Create a new trade row
                        const { error: tradeInsertError, data: tradeInsertData } = await supabase
                            .from('trades')
                            .insert({
                                proposer_id,
                                receiver_id,
                                offered_item_id,
                                requested_item_id,
                                status: 'accepted',
                                trade_notes: proposal.message || null,
                                exchange_mode: proposal.exchange_mode || null
                            })
                            .select();
                        if (tradeInsertError) {
                            console.error('[TradeProposals] Trade creation error:', tradeInsertError);
                            Alert.alert('Error', 'Failed to create trade: ' + tradeInsertError.message);
                            return;
                        }
                        console.log('[TradeProposals] Trade created successfully:', tradeInsertData);
                        tradeCreated = true;
                        // Update the product status to 'bartered'
                        const { error: itemUpdateError } = await supabase
                            .from('items')
                            .update({ status: 'bartered' })
                            .eq('id', requested_item_id);
                        if (itemUpdateError) {
                            console.error('[TradeProposals] Item status update error:', itemUpdateError);
                            Alert.alert('Error', 'Trade created, but failed to update item status: ' + itemUpdateError.message);
                        }
                    } else {
                        console.log('[TradeProposals] Trade already exists for this proposal:', existingTrades);
                    }
                } else {
                    console.error('[TradeProposals] Proposal not found in local state for proposalId:', proposalId);
                }
            }
            Alert.alert('Success', `Proposal ${action} successfully`);
            fetchProposals();
            if (action === 'accepted' || action === 'rejected' || tradeCreated) {
                if (refresh) refresh();
            }
        } catch (error) {
            console.error('[TradeProposals] Error updating proposal:', error);
            Alert.alert('Error', 'Failed to update proposal status: ' + error.message);
        }
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>Please sign in to view trade proposals</Text>
            </View>
        );
    }
    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#075eec" />
            </View>
        );
    }
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Trade Proposals</Text>
            {proposals.length === 0 ? (
                <Text style={styles.emptyText}>No trade proposals yet</Text>
            ) : (
                proposals.map((proposal) => {
                    let itemTitle = proposal.items?.title;
                    let itemImage = proposal.items?.image_url;
                    let itemOwnerId = proposal.items?.user_id;
                    if (proposal.item_id && itemTitles[proposal.item_id]) {
                        if (!itemTitle) itemTitle = itemTitles[proposal.item_id].title;
                        if (!itemImage) itemImage = itemTitles[proposal.item_id].image_url;
                        if (!itemOwnerId) itemOwnerId = itemTitles[proposal.item_id].user_id;
                    }
                    // Optionally, you can add a placeholder image URL here
                    const placeholderImage = 'https://via.placeholder.com/60x60?text=No+Image';
                    return (
                        <View key={proposal.id} style={styles.proposalCard}>
                            <TouchableOpacity 
                                style={styles.proposalHeaderWithImage}
                                onPress={() => router.push(`/item/${proposal.item_id}`)}
                            >
                                <Image
                                    source={{ uri: itemImage || placeholderImage }}
                                    style={styles.itemImage}
                                    resizeMode="cover"
                                />
                                <Text style={styles.proposalTitle}>
                                    {itemTitle || 'This item may have been deleted or is unavailable.'}
                                </Text>
                                <View style={[styles.statusBadge, styles[`status${proposal.status}`]]}>
                                    <Text style={styles.statusText}>
                                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            <Text style={styles.proposalInfo}>
                                {user.id === proposal.proposer_id ? 'You proposed to trade' : 'Someone proposed to trade'}
                            </Text>
                            <Text style={styles.description}>
                                {proposal.proposed_item_description}
                            </Text>
                            {proposal.message && (
                                <Text style={styles.message}>
                                    Message: {proposal.message}
                                </Text>
                            )}
                            {proposal.status === 'pending' && (
                                <View style={styles.actions}>
                                    {user.id === itemOwnerId ? (
                                        <>
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.acceptButton]}
                                                onPress={() => handleProposalAction(proposal.id, 'accepted')}
                                            >
                                                <MaterialCommunityIcons name="check" size={20} color="#fff" />
                                                <Text style={styles.actionButtonText}>Accept</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.rejectButton]}
                                                onPress={() => handleProposalAction(proposal.id, 'rejected')}
                                            >
                                                <MaterialCommunityIcons name="close" size={20} color="#fff" />
                                                <Text style={styles.actionButtonText}>Reject</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.cancelButton]}
                                            onPress={() => handleProposalAction(proposal.id, 'cancelled')}
                                        >
                                            <MaterialCommunityIcons name="cancel" size={20} color="#fff" />
                                            <Text style={styles.actionButtonText}>Cancel</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                            {proposal.status === 'accepted' && itemOwnerId && (
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: '#075eec', alignSelf: 'flex-end', marginTop: 8 }]}
                                    onPress={() => {
                                        router.push({
                                            pathname: '/(drawer)/(tabs)/chat',
                                            params: {
                                                userId: user.id,
                                                otherUserId: itemOwnerId,
                                                tradeId: proposal.id // optional, if you want to pass trade/proposal id
                                            }
                                        });
                                    }}
                                >
                                    <MaterialCommunityIcons name="chat" size={20} color="#fff" />
                                    <Text style={styles.actionButtonText}>Go to Chat</Text>
                                </TouchableOpacity>
                            )}
                            {proposal.status === 'accepted' && !itemOwnerId && (
                                <Text style={{ color: 'red', marginTop: 8 }}>
                                    Item or product owner not available for chat.
                                </Text>
                            )}
                        </View>
                    );
                })
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#2E3192',
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        fontSize: 16,
        marginTop: 20,
    },
    proposalCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    proposalHeaderWithImage: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemImage: {
        width: 120,
        height: 120,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#eee',
    },
    proposalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    statuspending: {
        backgroundColor: '#F59E0B',
    },
    statusaccepted: {
        backgroundColor: '#10B981',
    },
    statusrejected: {
        backgroundColor: '#EF4444',
    },
    statuscancelled: {
        backgroundColor: '#6B7280',
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    proposalInfo: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#1F2937',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic',
        marginBottom: 8,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 8,
    },
    acceptButton: {
        backgroundColor: '#10B981',
    },
    rejectButton: {
        backgroundColor: '#EF4444',
    },
    cancelButton: {
        backgroundColor: '#6B7280',
    },
    actionButtonText: {
        color: '#fff',
        marginLeft: 4,
        fontWeight: '600',
    },
}); 
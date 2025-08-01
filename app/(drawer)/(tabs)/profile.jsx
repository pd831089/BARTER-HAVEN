import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, TextInput, FlatList, Modal, ScrollView, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { supabase } from '@/Config/supabaseConfig';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { decode } from 'base64-arraybuffer';
import { Ionicons, FontAwesome, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TradeProposals from '@/app/components/TradeProposals';
import LocationPicker from '@/app/components/LocationPicker';
import LocationService from '@/app/services/locationService';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
const GRID_SPACING = 8;
const NUM_COLUMNS = 2;
const GRID_ITEM_SIZE = (width - (NUM_COLUMNS + 1) * GRID_SPACING - 24) / NUM_COLUMNS;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif'];

// MyListingCard component for FlatList (must be at top level, outside Profile)
function MyListingCard({ item, onPress, onRemove }) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 1.06, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={{ margin: 4 }}
    >
      <Animated.View
        style={[
          styles.gridItem,
          {
            transform: [{ scale: scaleAnim }],
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            borderRadius: 18,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.18)',
            backgroundColor: 'rgba(255,255,255,0.18)',
          },
        ]}
      >
        {/* Glassmorphism Blur Card Background */}
        <BlurView intensity={60} tint="light" style={{ ...StyleSheet.absoluteFillObject, borderRadius: 18 }} />
        {/* Card Image with gradient overlay */}
        <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%', borderRadius: 18, position: 'absolute', top: 0, left: 0, opacity: 0.93 }} />
        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 18, backgroundColor: 'linear-gradient(135deg,rgba(255,255,255,0.05),rgba(108,46,183,0.08))' }} />
        {/* Animated Gradient Border (simulated with shadow) */}
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: 'rgba(108,46,183,0.18)',
          zIndex: 1,
        }} />
        {/* Floating Status Badge (top-left) */}
        <View style={{
          position: 'absolute',
          top: 12,
          left: 12,
          backgroundColor: item.status === 'available' ? '#10B981CC'
            : item.status === 'proposed' ? '#F59E0BCC'
            : item.status === 'bartered' ? '#3B82F6CC'
            : '#9CA3AFCC',
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 4,
          zIndex: 3,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.2 }}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
        </View>
        {/* Floating Glowing Remove Button (top-right) */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 5,
            zIndex: 4,
            elevation: 6,
            shadowColor: '#FF3B30',
            shadowOpacity: 0.5,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
          }}
          onPress={onRemove}
        >
          <MaterialCommunityIcons name="close" size={22} color="#FF3B30" />
        </TouchableOpacity>
        {/* Floating Category Chip (bottom-left) */}
        <View style={{
          position: 'absolute',
          bottom: 60,
          left: 12,
          backgroundColor: 'rgba(108, 46, 183, 0.85)',
          borderRadius: 8,
          paddingHorizontal: 9,
          paddingVertical: 3,
          zIndex: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{item.category}</Text>
        </View>
        {/* Frosted Glass Overlay for Title & Edit (bottom) */}
        <BlurView intensity={70} tint="light" style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 54,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          overflow: 'hidden',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
        }}>
          <Text style={{ color: '#222', fontWeight: 'bold', fontSize: 14, flex: 1 }} numberOfLines={1}>{item.title}</Text>
          <View style={{ marginLeft: 8 }}>
            <Feather name="edit-2" size={18} color="#7048E8" />
          </View>
        </BlurView>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [myListings, setMyListings] = useState([]);
  const [tradesCount, setTradesCount] = useState(0);
  const [rating, setRating] = useState(5.0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [joinDate, setJoinDate] = useState(null);
  const [lastActive, setLastActive] = useState(null);
  const [successfulTrades, setSuccessfulTrades] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [tradeProposals, setTradeProposals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [disputes, setDisputes] = useState({});
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [userLocationData, setUserLocationData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchUserProfile();
    fetchMyListings();
    fetchTradesCount();
    fetchFavorites();
    fetchTradeProposals();
    fetchTransactions();
    fetchDisputes();
  }, []);

  const getCurrentUserId = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser) throw new Error('No authenticated user');
      return authUser.id;
    } catch (error) {
      console.error('Error getting user ID:', error);
      throw new Error('Failed to get user information');
    }
  };

  const fetchUserProfile = async () => {
    try {
      const userId = await getCurrentUserId();

      // Fetch user profile with location data
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          profile_image_url,
          bio,
          phone_number,
          location,
          latitude,
          longitude,
          address_street,
          address_city,
          address_region,
          address_postal_code,
          address_country,
          rating,
          total_ratings,
          join_date,
          last_active,
          successful_trades
        `)
        .eq('id', userId)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // Create new profile if it doesn't exist
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert([{
              id: userId,
              created_at: new Date().toISOString(),
              join_date: new Date().toISOString()
            }])
            .select()
            .single();

          if (createError) throw createError;
          setUser(newProfile);
          setName(newProfile.name || '');
          setProfileImage(newProfile.profile_image_url);
          setBio('');
          setPhoneNumber('');
          setLocation('');
          setRating(5.0);
          setTotalRatings(0);
          setJoinDate(new Date().toISOString());
          setLastActive(new Date().toISOString());
          setSuccessfulTrades(0);
          setUserLocationData(null);
          return;
        }
        throw profileError;
      }

      setUser(profile);
      setName(profile.name || '');
      setProfileImage(profile.profile_image_url);
      setBio(profile.bio || '');
      setPhoneNumber(profile.phone_number || '');
      setLocation(profile.location || '');
      setRating(profile.rating || 5.0);
      setTotalRatings(profile.total_ratings || 0);
      setJoinDate(profile.join_date);
      setLastActive(profile.last_active);
      setSuccessfulTrades(profile.successful_trades || 0);

      // Set location data if available
      if (profile.latitude && profile.longitude) {
        setUserLocationData({
          latitude: profile.latitude,
          longitude: profile.longitude,
          address: {
            street: profile.address_street || '',
            city: profile.address_city || '',
            region: profile.address_region || '',
            postalCode: profile.address_postal_code || '',
            country: profile.address_country || '',
            fullAddress: profile.location || '',
          },
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyListings = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', authUser.id)
        .not('status', 'eq', 'removed')  // Don't show removed items
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      Alert.alert('Error', 'Failed to load your listings');
    }
  };

  const fetchTradesCount = async () => {
    // If you have a trades table, count trades where user is involved
    // Example:
    // const { data, error, count } = await supabase
    //   .from('trades')
    //   .select('*', { count: 'exact', head: true })
    //   .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    // setTradesCount(count || 0);
  };

  const fetchFavorites = async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;
      // Get favorite item IDs
      const { data: favs, error: favsError } = await supabase
        .from('favorites')
        .select('item_id')
        .eq('user_id', userId);
      if (favsError) throw favsError;
      setFavorites(favs.map(f => f.item_id));
      if (favs.length === 0) {
        setFavoriteItems([]);
        return;
      }
      // Fetch item details for favorites
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .in('id', favs.map(f => f.item_id));
      if (itemsError) throw itemsError;
      setFavoriteItems(items || []);
    } catch (error) {
      setFavoriteItems([]);
    }
  };

  const fetchTradeProposals = async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      // Fetch proposals where user is the proposer
      const { data: sentProposals, error: sentError } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          items:item_id(*, users(*))
        `)
        .eq('proposer_id', userId)
        .order('created_at', { ascending: false });

      // Fetch proposals where user is the item owner
      const { data: receivedProposals, error: receivedError } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          items:item_id(*, users(*))
        `)
        .eq('items.user_id', userId)
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;
      if (receivedError) throw receivedError;

      setTradeProposals({
        sent: sentProposals || [],
        received: receivedProposals || []
      });
    } catch (error) {
      console.error('Error fetching trade proposals:', error);
      Alert.alert('Error', 'Failed to load trade proposals');
    }
  };

  const handleTradeProposal = async (proposalId, action) => {
    try {
      const { error } = await supabase
        .from('trade_proposals')
        .update({ status: action })
        .eq('id', proposalId);

      if (error) throw error;

      // Refresh proposals
      fetchTradeProposals();

      Alert.alert(
        'Success',
        `Trade proposal ${action} successfully!`
      );
    } catch (error) {
      console.error('Error updating trade proposal:', error);
      Alert.alert('Error', 'Failed to update trade proposal');
    }
  };

  const uploadProfileImage = async (uri) => {
    try {
      if (!uri.startsWith('file://')) {
        throw new Error('Invalid image format');
      }

      // Get user ID first
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Check file size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.size > MAX_IMAGE_SIZE) {
        throw new Error('Image size should be less than 5MB');
      }

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Generate unique filename
      const fileExt = uri.split('.').pop().toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.includes(fileExt)) {
        throw new Error('Invalid image format. Please use JPG, PNG, or GIF');
      }

      const fileName = `${userId}-profile-${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;

      // Upload to Supabase with retry logic
      let uploadAttempts = 0;
      const maxAttempts = 3;
      let uploadError;

      while (uploadAttempts < maxAttempts) {
        try {
          const { error: uploadError, data } = await supabase.storage
            .from('items')
            .upload(filePath, bytes, {
              contentType: `image/${fileExt}`,
              cacheControl: '3600',
              upsert: true,
            });

          if (uploadError) throw uploadError;
          if (!data) throw new Error('No data returned from upload');

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('items')
            .getPublicUrl(data.path);

          if (!publicUrl) throw new Error('Failed to get public URL');

          return publicUrl;
        } catch (error) {
          uploadError = error;
          uploadAttempts++;
          if (uploadAttempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
          }
        }
      }

      throw uploadError || new Error('Failed to upload image after multiple attempts');
    } catch (error) {
      console.error('Image upload error:', error);
      throw new Error(error.message || 'Failed to upload image');
    }
  };

  const handleLocationSelect = (locationData) => {
    setUserLocationData(locationData);
    if (locationData.address?.fullAddress) {
      setLocation(locationData.address.fullAddress);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setUploadProgress(0);

      // Validate inputs
      if (!name.trim()) {
        throw new Error('Name is required');
      }

      // Get user ID first
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      let profileImageUrl = profileImage;

      // Handle image upload if there's a new image
      if (profileImage && profileImage.startsWith('file://')) {
        try {
          setUploadProgress(20);
          profileImageUrl = await uploadProfileImage(profileImage);
          setUploadProgress(60);
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          throw new Error('Failed to upload profile image. Please try again.');
        }
      }

      // Prepare update data
      const updateData = {
        name: name.trim(),
        profile_image_url: profileImageUrl,
        bio: bio.trim(),
        phone_number: phoneNumber.trim(),
        location: location.trim(),
        updated_at: new Date().toISOString()
      };

      // Add location data if available
      if (userLocationData && userLocationData.latitude && userLocationData.longitude) {
        updateData.latitude = userLocationData.latitude;
        updateData.longitude = userLocationData.longitude;
        updateData.address_street = userLocationData.address.street;
        updateData.address_city = userLocationData.address.city;
        updateData.address_region = userLocationData.address.region;
        updateData.address_postal_code = userLocationData.address.postalCode;
        updateData.address_country = userLocationData.address.country;
        updateData.location_updated_at = new Date().toISOString();
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw new Error('Failed to update profile information');
      }

      setUploadProgress(100);

      // Update local state
      setUser({
        ...user,
        name: name.trim(),
        bio: bio.trim(),
        profile_image_url: profileImageUrl,
        phone_number: phoneNumber.trim(),
        location: location.trim()
      });

      setEditing(false);
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update profile. Please try again.'
      );
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Select Image Source',
      'Choose where to get the image from',
      [
        {
          text: 'Camera',
          onPress: () => {
            Alert.alert(
              'Camera Permission',
              'This app needs camera access to take photos',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: takePhoto }
              ]
            );
          }
        },
        { text: 'Gallery', onPress: handleImagePick },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable camera access in your device settings');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled) {
        // Check image size before setting
        const fileInfo = await FileSystem.getInfoAsync(result.assets[0].uri);
        if (fileInfo.size > MAX_IMAGE_SIZE) {
          Alert.alert('Error', 'Image size should be less than 5MB');
          return;
        }
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable photo library access in your device settings');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled) {
        // Check image size before setting
        const fileInfo = await FileSystem.getInfoAsync(result.assets[0].uri);
        if (fileInfo.size > MAX_IMAGE_SIZE) {
          Alert.alert('Error', 'Image size should be less than 5MB');
          return;
        }
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      const { error } = await supabase.rpc('remove_item', {
        p_item_id: itemId,
        p_user_id: user.id
      });

      if (error) throw error;
      
      // Refresh listings
      fetchMyListings();
      Alert.alert('Success', 'Item removed successfully');
    } catch (error) {
      console.error('Error removing item:', error);
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const fetchTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('transactions')
        .select('*, items(*)')
        .or(`proposer_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      // Collect all unique user IDs (proposer and receiver)
      const userIds = Array.from(new Set((data || []).flatMap(t => [t.proposer_id, t.receiver_id])));
      // Fetch user info in batch
      let userMap = {};
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, profile_image_url')
          .in('id', userIds);
        if (!usersError && usersData) {
          usersData.forEach(u => { userMap[u.id] = u; });
        }
      }
      // Attach user info to each transaction
      const transactionsWithUsers = (data || []).map(t => ({
        ...t,
        proposer: userMap[t.proposer_id] || { id: t.proposer_id, name: 'User' },
        receiver: userMap[t.receiver_id] || { id: t.receiver_id, name: 'User' },
      }));
      setTransactions(transactionsWithUsers);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchDisputes = async () => {
    try {
      const userId = await getCurrentUserId();
      // Fetch all disputes for this user's transactions (as reporter or as transaction party)
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .or(`user_id.eq.${userId},transaction_id.in.(${transactions.map(t => `'${t.id}'`).join(',')})`);
      if (error) throw error;
      // Map disputes by transaction_id
      const disputeMap = {};
      (data || []).forEach(d => { disputeMap[d.transaction_id] = d; });
      setDisputes(disputeMap);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    }
  };

  const renderTransaction = ({ item }) => {
    const isProposer = item.proposer_id === user.id;
    const otherParty = isProposer ? item.receiver : item.proposer;
    const dispute = disputes[item.id];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' }}>
        <Image source={{ uri: item.items?.image_url }} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: 'bold', color: '#1F2937' }}>{item.items?.title || 'Item'}</Text>
          <Text style={{ color: '#6B7280', fontSize: 13 }}>With: {otherParty?.name || 'User'}</Text>
          <Text style={{ color: '#10B981', fontSize: 13 }}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
          {item.completed_at && <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Completed: {new Date(item.completed_at).toLocaleDateString()}</Text>}
          {/* Dispute UI */}
          {dispute ? (
            <View style={{ marginTop: 4 }}>
              <Text style={{ color: dispute.status === 'resolved' ? '#10B981' : '#F59E0B', fontSize: 13 }}>
                Dispute: {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
              </Text>
              {dispute.resolution && <Text style={{ color: '#374151', fontSize: 12 }}>Resolution: {dispute.resolution}</Text>}
            </View>
          ) : (
            <TouchableOpacity
              style={{ marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
              onPress={() => {
                setSelectedTransaction(item);
                setShowDisputeModal(true);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Report Issue</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
        {uploadProgress > 0 && (
          <Text style={styles.uploadProgress}>Uploading: {uploadProgress}%</Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Gradient Header */}
      <LinearGradient
        colors={['#075eec', '#3B82F6', '#67C6FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.profileImageWrapper}>
            <Image
              source={profileImage ? { uri: profileImage } : require('@/assets/images/placeholder.jpg')}
              style={styles.profileImage}
            />
            <TouchableOpacity style={styles.editPicButton} onPress={showImagePickerOptions}>
              <Feather name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{name || 'No name set'}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{myListings.length}</Text>
            <Text style={styles.statLabel}>Listings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{successfulTrades}</Text>
            <Text style={styles.statLabel}>Trades</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{`${totalRatings} Rating${totalRatings !== 1 ? 's' : ''}`}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* User Info Cards */}
      <View style={styles.infoSection}>
        {location && (
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="map-marker-outline" size={20} color="#075eec" />
            <Text style={styles.infoText}>{location}</Text>
          </View>
        )}
        
        {phoneNumber && (
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="phone-outline" size={20} color="#075eec" />
            <Text style={styles.infoText}>{phoneNumber}</Text>
          </View>
        )}

        {bio && (
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="text-box-outline" size={20} color="#075eec" />
            <Text style={styles.infoText}>{bio}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="clock-outline" size={20} color="#075eec" />
          <Text style={styles.infoText}>
            Joined {joinDate ? new Date(joinDate).toLocaleDateString() : 'Recently'}
          </Text>
        </View>
      </View>

      {/* Floating Edit Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowEditModal(true)}>
        <Feather name="edit-2" size={22} color="#fff" />
      </TouchableOpacity>

      {/* My Listings Grid */}
      <Text style={styles.sectionTitle}>My Listings</Text>
      <FlatList
        data={myListings}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MyListingCard
            item={item}
            onPress={() => router.push(`/item/${item.id}`)}
            onRemove={() => {
              Alert.alert(
                'Remove Item',
                'Are you sure you want to remove this item?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => handleRemoveItem(item.id) }
                ]
              );
            }}
          />
        )}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContainer}
        ListEmptyComponent={
          <View style={styles.emptyListings}>
            <MaterialCommunityIcons name="image-off-outline" size={50} color="#ccc" />
            <Text style={styles.emptyListingsText}>No listings yet</Text>
          </View>
        }
        scrollEnabled={false}
      />

      {/* My Favorites Grid */}
      <Text style={styles.sectionTitle}>My Favorites</Text>
      <FlatList
        data={favoriteItems}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => router.push(`/item/${item.id}`)}
          >
            <Image source={{ uri: item.image_url }} style={styles.gridImage} />
            <View style={styles.gridItemOverlay}>
              <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
            </View>
          </TouchableOpacity>
        )}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.gridContainer}
        ListEmptyComponent={
          <View style={styles.emptyListings}>
            <MaterialCommunityIcons name="heart-outline" size={50} color="#ccc" />
            <Text style={styles.emptyListingsText}>No favorites yet</Text>
          </View>
        }
        scrollEnabled={false}
      />

      {/* Trade Proposals Section */}
      <View style={styles.section}>
        <TradeProposals />
      </View>

      {/* Barter History Section */}
     <View style={{ backgroundColor: '#fff', borderRadius: 12, margin: 16, padding: 16, elevation: 2 }}>
       <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#1F2937' }}>Barter History</Text>
       {transactionsLoading ? (
         <ActivityIndicator size="small" color="#075eec" />
       ) : transactions.length === 0 ? (
         <Text style={{ color: '#6B7280' }}>No completed barters yet.</Text>
       ) : (
         <FlatList
           data={transactions}
           renderItem={renderTransaction}
           keyExtractor={item => item.id}
           scrollEnabled={false}
         />
       )}
       {/* Dispute Modal */}
       <Modal visible={showDisputeModal} animationType="slide" transparent onRequestClose={() => setShowDisputeModal(false)}>
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
           <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%' }}>
             <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Report Issue</Text>
             <Text style={{ marginBottom: 8, color: '#374151' }}>Describe the issue with this barter transaction.</Text>
             <TextInput
               value={disputeReason}
               onChangeText={setDisputeReason}
               placeholder="Reason for dispute"
               multiline
               style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 10, marginBottom: 12, minHeight: 60 }}
             />
             <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
               <TouchableOpacity onPress={() => setShowDisputeModal(false)} style={{ marginRight: 16 }}>
                 <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Cancel</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 onPress={async () => {
                   if (!disputeReason.trim()) return;
                   setDisputeSubmitting(true);
                   try {
                     const { data: { user } } = await supabase.auth.getUser();
                     const { error } = await supabase
                       .from('disputes')
                       .insert({
                         transaction_id: selectedTransaction.id,
                         user_id: user.id,
                         reason: disputeReason.trim(),
                         status: 'open',
                         created_at: new Date().toISOString(),
                         updated_at: new Date().toISOString(),
                       });
                     if (error) throw error;
                     setShowDisputeModal(false);
                     setDisputeReason('');
                     setSelectedTransaction(null);
                     fetchDisputes();
                     Alert.alert('Success', 'Dispute submitted. Our team will review it.');
                   } catch (err) {
                     Alert.alert('Error', 'Failed to submit dispute.');
                   } finally {
                     setDisputeSubmitting(false);
                   }
                 }}
                 disabled={disputeSubmitting || !disputeReason.trim()}
                 style={{ backgroundColor: '#F59E0B', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6 }}
               >
                 <Text style={{ color: '#fff', fontWeight: 'bold' }}>{disputeSubmitting ? 'Submitting...' : 'Submit'}</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>
     </View>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TextInput
                style={[styles.input, !name.trim() && styles.inputError]}
                value={name}
                onChangeText={setName}
                placeholder="Name *"
              />
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Phone Number"
                keyboardType="phone-pad"
              />
              
              {/* Location Picker Component */}
              <LocationPicker
                onLocationSelect={handleLocationSelect}
                initialLocation={userLocationData}
                placeholder="Enter your address..."
              />
              
              <TextInput
                style={styles.input}
                value={bio}
                onChangeText={setBio}
                placeholder="Bio"
                multiline
                numberOfLines={3}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ccc' }]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, !name.trim() && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={loading || !name.trim()}
              >
                <Text style={styles.modalButtonText}>
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 30,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#eee',
  },
  editPicButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFA500',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 20,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    top: 120,
    right: 24,
    backgroundColor: '#075eec',
    borderRadius: 30,
    padding: 14,
    elevation: 5,
    zIndex: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 18,
    marginTop: 18,
    marginBottom: 8,
  },
  gridContainer: {
    padding: GRID_SPACING,
    paddingHorizontal: 12,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE * 1.18,
    margin: GRID_SPACING / 2,
    borderRadius: 18,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
    borderRadius: 18,
  },
  gridItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
  },
  gridTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyListings: {
    alignItems: 'center',
    padding: 40,
  },
  emptyListingsText: {
    color: '#666',
    marginTop: 10,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalScroll: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#F3F4F6',
    color: '#1F2937',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalButton: {
    backgroundColor: '#075eec',
    padding: 12,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  uploadProgress: {
    marginTop: 10,
    color: '#3B82F6',
    fontSize: 16,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 20,
  },
  infoSection: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusavailable: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)', // Green
  },
  statusproposed: {
    backgroundColor: 'rgba(245, 158, 11, 0.9)', // Orange
  },
  statusbartered: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)', // Blue
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
    zIndex: 3,
  },
});


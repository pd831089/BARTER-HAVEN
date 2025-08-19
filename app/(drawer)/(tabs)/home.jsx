import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, ScrollView, FlatList, ActivityIndicator, RefreshControl, Alert, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/Config/supabaseConfig';
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { categories as allCategories } from '@/Config/categories';
import { SearchContext } from './_layout';
import BannerCarousel from '@/app/components/BannerCarousel';

const { width } = Dimensions.get('window');

const homeCategoryNames = [
  'Electronics',
  'Books',
  'Clothing',
  'Free',
  'Art',
  'Collectibles',
  'Other',
  'Tools',
];
const categories = allCategories.filter(cat => homeCategoryNames.includes(cat.name));

export default function Home({ navigation }) {
  const [fontsLoaded] = useFonts({
    Outfit: require('../../../assets/fonts/Outfit-Regular.ttf'),
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const params = useLocalSearchParams();
  const [currentUserId, setCurrentUserId] = useState(null);
  const router = useRouter();
  const { search } = useContext(SearchContext);
  const [userMap, setUserMap] = useState({});
  const [favorites, setFavorites] = useState([]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*, users: user_id (name, profile_image_url)')
        .neq('status', 'removed')
        .order('created_at', { ascending: false })
        .limit(20);

      console.log('Fetched items:', data);

      if (error) throw error;
      // If users join is missing for any item, fetch user info for all unique user_ids
      const missingUserIds = (data || [])
        .filter(item => !item.users)
        .map(item => item.user_id);
      let userMap = {};
      if (missingUserIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, profile_image_url')
          .in('id', missingUserIds);
        if (!usersError && usersData) {
          usersData.forEach(u => { userMap[u.id] = u; });
        }
      }
      // Attach user info to items if missing
      const itemsWithUsers = (data || []).map(item => {
        if (!item.users && userMap[item.user_id]) {
          return { ...item, users: userMap[item.user_id] };
        }
        return item;
      });
      setItems(itemsWithUsers);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (params.refresh) {
      fetchItems();
    }
  }, [params.refresh]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('favorites')
        .select('item_id')
        .eq('user_id', user.id);
      if (!error && data) {
        setFavorites(data.map(fav => fav.item_id));
      }
    };
    fetchFavorites();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const handleDelete = async (itemId) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('items').delete().eq('id', itemId);
            if (error) {
              Alert.alert('Error', 'Failed to delete item.');
            } else {
              fetchItems();
              Alert.alert('Deleted', 'Item deleted successfully.');
            }
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (itemId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (favorites.includes(itemId)) {
      // Unlike
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('item_id', itemId);
      setFavorites(favorites.filter(id => id !== itemId));
    } else {
      // Like
      await supabase.from('favorites').insert([{ user_id: user.id, item_id: itemId }], { upsert: true });
      setFavorites([...favorites, itemId]);
    }
  };

  // Filter items based on search
  const filteredItems = items.filter(item => {
    const q = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  const renderItem = ({ item }) => (
    <View style={styles.productCard}>
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: item.image_url }}
          style={styles.productImage}
          resizeMode="cover"
        />
        {/* Only show favorite button for other users' products */}
        {currentUserId && item.user_id !== currentUserId && (
          <TouchableOpacity style={styles.favoriteIcon} onPress={() => handleToggleFavorite(item.id)}>
            <Ionicons name={favorites.includes(item.id) ? "heart" : "heart-outline"} size={22} color={favorites.includes(item.id) ? "#e74c3c" : "#d1d5db"} />
          </TouchableOpacity>
        )}
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
        {/* Barter Type Tag */}
        <View style={{
          position: 'absolute',
          top: 12 + 28, // 12px top + 24px badge height + 6px margin
          left: 12,
          backgroundColor: 'rgba(255, 165, 0, 0.9)',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 6,
          zIndex: 2,
        }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.bartertype || 'Online Barter'}</Text>
        </View>
        {/* Category Tag */}
        <View style={{
          position: 'absolute',
          top: 12 + 28 + 32, // 12px top + 24px badge + 6px margin + 26px barter tag + 6px margin
          left: 12,
          backgroundColor: 'rgba(108, 46, 183, 0.9)',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 6,
          zIndex: 2,
        }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.category}</Text>
        </View>
      </View>
      <View style={styles.userInfoRow}>
        {item.users?.profile_image_url ? (
          <Image
            source={{ uri: item.users.profile_image_url }}
            style={styles.avatarCircle}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{item.users?.name?.[0]?.toUpperCase() || "U"}</Text>
          </View>
        )}
        <Text style={styles.username}>{item.users?.name || "User"}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>OFFERING:</Text>
        <Text style={styles.offerTitle} numberOfLines={1}>{item.offering || item.title}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>IN EXCHANGE FOR:</Text>
        <Text style={styles.exchangeTitle} numberOfLines={1}>{item.exchangefor || "Open to Offers"}</Text>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.viewDetailsButton} onPress={() => router.push(`/item/${item.id}`)}>
          <Text style={styles.viewDetailsText}>View Details</Text>
        </TouchableOpacity>
        {currentUserId && item.user_id === currentUserId && (
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
            <Feather name="trash-2" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (!fontsLoaded) {
    return <View style={styles.loading}><Text>Loading...</Text></View>;
  }

  return (
    <FlatList
      key={'one-column'}
      numColumns={1}
      ListHeaderComponent={
        <>
          {/* Banner Carousel */}
          <View style={styles.bannerWrapper}>
            <BannerCarousel autoplay={true} autoplayInterval={5000}>
              <View style={styles.slide}>
                <LinearGradient 
                  colors={['#7928CA', '#FF0080']} 
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradient}
                >
                  <View style={styles.banner}>
                    <View style={styles.geometricAccent} />
                    <View style={styles.bannerContent}>
                      <View style={styles.titleContainer}>
                        <Text style={styles.bannerHighlight}>WELCOME TO</Text>
                        <Text style={styles.title}>BarterHaven</Text>
                      </View>
                      <View style={styles.subtitleContainer}>
                        <Text style={styles.subtitle}>Trade Smarter, Get Better</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>
              <View style={styles.slide}>
                <LinearGradient 
                  colors={['#7048E8', '#00F5A0']} 
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.gradient}
                >
                  <View style={styles.banner}>
                    <View style={[styles.geometricAccent, styles.geometricAccentRight]} />
                    <View style={styles.bannerContent}>
                      <View style={styles.titleContainer}>
                        <Text style={styles.bannerHighlight}>DISCOVER</Text>
                        <Text style={styles.title}>Endless Trades</Text>
                      </View>
                      <View style={styles.subtitleContainer}>
                        <Text style={styles.subtitle}>Your Items, Infinite Possibilities</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </BannerCarousel>
          </View>
          {/* Categories Section */}
          <View style={styles.categoriesContainer}>
            {categories.map((category, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.category} 
                onPress={() => router.push(`/category/${category.name}`)}
              >
                <View style={styles.categoryInner}>
                  <Image source={category.image} style={styles.categoryIcon} />
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.latestListingsContainer}>
            <Text style={styles.sectionTitle}>Latest Listings</Text>
          </View>
        </>
      }
      data={filteredItems}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={styles.contentContainerStyle}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator size="large" color="#075eec" style={styles.loadingIndicator} />
        ) : (
          <Text style={{ textAlign: 'center', marginTop: 20 }}>No listings found.</Text>
        )
      }
    />
  );
}

function BarterBanner({ title, subtitle }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
    backgroundColor: '#F3F4F6',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  bannerWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 16,
    marginHorizontal: 16,
    width: width - 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  slide: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 24,
  },
  gradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  geometricAccent: {
    position: 'absolute',
    width: 150,
    height: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 75,
    top: -50,
    left: -50,
    transform: [{ rotate: '45deg' }],
  },
  geometricAccentRight: {
    left: 'auto',
    right: -50,
    transform: [{ rotate: '-45deg' }],
  },
  banner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  bannerContent: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1,
  },
  titleContainer: {
    marginBottom: 16,
  },
  bannerHighlight: {
    fontSize: 14,
    fontFamily: 'Outfit',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 4,
    marginBottom: 8,
    fontWeight: '600',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    textAlign: 'left',
    fontFamily: 'Outfit',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 44,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitleContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(8px)',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Outfit',
    color: '#ffffff',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    backgroundColor: '#F3F4F6',
  },
  category: {
    width: '25%', // 4 columns
    aspectRatio: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Outfit',
    width: '100%',
  },
  latestListingsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1F2937',
  },
  loadingIndicator: {
    marginTop: 20,
  },
  productCard: {
    width: '92%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    marginVertical: 12,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  favoriteIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 8,
    zIndex: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  barterTypeTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 165, 0, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 2,
  },
  barterTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryTag: {
    position: 'absolute',
    top: 50,
    left: 12,
    backgroundColor: 'rgba(108, 46, 183, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 2,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#b0bec5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  username: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1F2937',
  },
  section: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: {
    fontWeight: '700',
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  offerTitle: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
  },
  exchangeTitle: {
    fontWeight: '600',
    fontSize: 15,
    color: '#1F2937',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  viewDetailsButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flex: 1,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  viewDetailsText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  chatButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContainer: {
    padding: 10,
    backgroundColor: '#F3F4F6',
  },
  contentContainerStyle: { 
    flexGrow: 1, 
    backgroundColor: '#F3F4F6',
    paddingBottom: 10,
    paddingTop: 0,
    paddingHorizontal: 0 // Remove horizontal padding since banner has its own margin
  },
  statusTag: {
    position: 'absolute',
    top: 88,
    left: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 2,
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
    fontSize: 12,
    fontWeight: '700',
  },
});

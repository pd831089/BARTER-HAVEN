import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { categories } from '@/Config/categories';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const numColumns = 3;
const tileSize = (width - 48) / numColumns;

export default function ExploreScreen() {
    const router = useRouter();

    const renderCategory = ({ item }) => (
        <TouchableOpacity
            style={styles.categoryTile}
            onPress={() => router.push(`/category/${item.name}`)}
        >
            <View style={styles.imageContainer}>
                <Image source={item.image} style={styles.categoryImage} />
            </View>
            <Text style={styles.categoryName}>{item.name}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={categories}
                renderItem={renderCategory}
                keyExtractor={(item) => item.name}
                numColumns={numColumns}
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    gridContainer: {
        padding: 16,
    },
    categoryTile: {
        width: tileSize,
        aspectRatio: 1,
        margin: 4,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    imageContainer: {
        width: '70%',
        aspectRatio: 1,
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    categoryName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#1F2937',
        textAlign: 'center',
    },
});

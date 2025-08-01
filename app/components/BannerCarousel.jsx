import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    interpolate,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const BannerCarousel = ({ children, autoplay = true, autoplayInterval = 5000 }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useSharedValue(0);
    const flatListRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (autoplay) {
            startAutoplay();
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [autoplay, currentIndex]);

    const startAutoplay = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        timerRef.current = setInterval(() => {
            const nextIndex = (currentIndex + 1) % React.Children.count(children);
            try {
                flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                setCurrentIndex(nextIndex);
            } catch (error) {
                // Fallback to scroll to offset if scrollToIndex fails
                flatListRef.current?.scrollToOffset({ offset: nextIndex * width, animated: true });
                setCurrentIndex(nextIndex);
            }
        }, autoplayInterval);
    };

    const renderDot = (index) => {
        const dotStyle = useAnimatedStyle(() => {
            const input = scrollX.value;
            const scale = interpolate(
                input,
                [(index - 1) * width, index * width, (index + 1) * width],
                [1, 1.5, 1],
                'clamp'
            );
            const opacity = interpolate(
                input,
                [(index - 1) * width, index * width, (index + 1) * width],
                [0.5, 1, 0.5],
                'clamp'
            );
            return {
                transform: [{ scale }],
                opacity,
            };
        });

        return (
            <TouchableOpacity
                key={index}
                onPress={() => {
                    try {
                        flatListRef.current?.scrollToIndex({ index, animated: true });
                        setCurrentIndex(index);
                    } catch (error) {
                        // Fallback to scroll to offset if scrollToIndex fails
                        flatListRef.current?.scrollToOffset({ offset: index * width, animated: true });
                        setCurrentIndex(index);
                    }
                }}
            >
                <Animated.View style={[styles.dot, dotStyle]} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Animated.FlatList
                ref={flatListRef}
                data={React.Children.toArray(children)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(event) => {
                    scrollX.value = event.nativeEvent.contentOffset.x;
                }}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                    <View style={styles.slide}>{item}</View>
                )}
                keyExtractor={(_, index) => index.toString()}
                getItemLayout={(data, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                onScrollToIndexFailed={(info) => {
                    // Fallback: scroll to the nearest valid offset
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: true,
                    });
                }}
            />
            <View style={styles.pagination}>
                {React.Children.map(children, (_, index) => renderDot(index))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 250,
    },
    slide: {
        width,
        height: 250,
    },
    pagination: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: 10,
        alignSelf: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginHorizontal: 4,
    },
});

export default BannerCarousel; 
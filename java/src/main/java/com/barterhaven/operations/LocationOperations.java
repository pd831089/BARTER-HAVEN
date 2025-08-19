package com.barterhaven.operations;

import com.barterhaven.algorithms.HaversineDistanceCalculator;

import java.util.*;
import java.util.stream.*;

public final class LocationOperations {
    public static final class UserLocation { public final String userId; public final Double lat; public final Double lon; public UserLocation(String userId, Double lat, Double lon){this.userId=userId; this.lat=lat; this.lon=lon;} }
    public interface UserRepository { void updateLocation(String userId, Double lat, Double lon); Optional<UserLocation> getLocation(String userId); }
    public interface ItemRepository { void updateLocation(String itemId, Double lat, Double lon); List<MatchingEngine.Item> findAllItems(); }

    public static final class InMemoryUserRepo implements UserRepository {
        private final Map<String, UserLocation> store = new HashMap<>();
        public void updateLocation(String userId, Double lat, Double lon) { store.put(userId, new UserLocation(userId, lat, lon)); }
        public Optional<UserLocation> getLocation(String userId) { return Optional.ofNullable(store.get(userId)); }
    }

    public static final class InMemoryItemRepo implements ItemRepository {
        private final Map<String, MatchingEngine.Item> items = new HashMap<>();
        public void updateLocation(String itemId, Double lat, Double lon) { items.computeIfAbsent(itemId, MatchingEngine.Item::new); items.get(itemId).lat = lat; items.get(itemId).lon = lon; }
        public List<MatchingEngine.Item> findAllItems() { return new ArrayList<>(items.values()); }
    }

    private LocationOperations() {}

    public static boolean saveUserLocation(UserRepository repo, String userId, double lat, double lon) {
        repo.updateLocation(userId, lat, lon); return true;
    }
    public static boolean saveItemLocation(ItemRepository repo, String itemId, double lat, double lon) {
        repo.updateLocation(itemId, lat, lon); return true;
    }
    public static Optional<UserLocation> getUserLocation(UserRepository repo, String userId) {
        return repo.getLocation(userId);
    }
    public static List<MatchingEngine.Item> findItemsWithinRadius(ItemRepository repo, double userLat, double userLon, double radiusKm) {
        return repo.findAllItems().stream()
                .filter(i -> i.lat != null && i.lon != null)
                .filter(i -> HaversineDistanceCalculator.distanceKm(userLat, userLon, i.lat, i.lon) <= radiusKm)
                .collect(Collectors.toList());
    }

    public static void main(String[] args) {
        InMemoryUserRepo userRepo = new InMemoryUserRepo();
        InMemoryItemRepo itemRepo = new InMemoryItemRepo();
        saveUserLocation(userRepo, "u1", 37.78, -122.43);
        itemRepo.updateLocation("i1", 37.79, -122.44);
        System.out.println(getUserLocation(userRepo, "u1").isPresent());
        System.out.println(findItemsWithinRadius(itemRepo, 37.78, -122.43, 5.0).size());
    }
}



package com.barterhaven.algorithms;

import java.util.*;
import java.util.stream.*;

public final class ItemsWithinRadiusFilter {
    public static final class GeoItem {
        public final String id; public final Double lat; public final Double lon;
        public GeoItem(String id, Double lat, Double lon) { this.id = id; this.lat = lat; this.lon = lon; }
    }

    private ItemsWithinRadiusFilter() {}

    public static List<GeoItem> filter(List<GeoItem> items, double userLat, double userLon, double radiusKm) {
        return items.stream()
                .filter(it -> it.lat != null && it.lon != null)
                .filter(it -> HaversineDistanceCalculator.distanceKm(userLat, userLon, it.lat, it.lon) <= radiusKm)
                .collect(Collectors.toList());
    }

    public static void main(String[] args) {
        List<GeoItem> items = Arrays.asList(new GeoItem("A", 37.78, -122.43), new GeoItem("B", 37.50, -122.00));
        System.out.println(filter(items, 37.78, -122.43, 5.0).size());
    }
}



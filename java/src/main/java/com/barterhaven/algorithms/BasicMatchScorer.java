package com.barterhaven.algorithms;

import java.util.*;

public final class BasicMatchScorer {
    public static final double CATEGORY_WEIGHT = 0.30;
    public static final double TAG_WEIGHT = 0.25;
    public static final double VALUE_WEIGHT = 0.25;
    public static final double LOCATION_WEIGHT = 0.20;

    public static final class Item {
        public final String id;
        public final String category;
        public final List<String> tags;
        public final Double estimatedValue;
        public final Double lat;
        public final Double lon;

        public Item(String id, String category, List<String> tags, Double estimatedValue, Double lat, Double lon) {
            this.id = id;
            this.category = category;
            this.tags = tags == null ? List.of() : List.copyOf(tags);
            this.estimatedValue = estimatedValue;
            this.lat = lat;
            this.lon = lon;
        }
    }

    private BasicMatchScorer() {}

    public static double score(Item a, Item b) {
        double categoryScore = (a.category != null && a.category.equals(b.category)) ? CATEGORY_WEIGHT : 0.0;

        double tagScore = 0.0;
        if (!a.tags.isEmpty() && !b.tags.isEmpty()) {
            Set<String> setA = new HashSet<>(a.tags);
            Set<String> setB = new HashSet<>(b.tags);
            setA.retainAll(setB);
            int intersection = setA.size();
            int denom = Math.max(a.tags.size(), b.tags.size());
            if (denom > 0) tagScore = (intersection / (double) denom) * TAG_WEIGHT;
        }

        double valueScore = 0.0;
        if (a.estimatedValue != null && b.estimatedValue != null && a.estimatedValue > 0 && b.estimatedValue > 0) {
            double diff = Math.abs(a.estimatedValue - b.estimatedValue);
            double maxV = Math.max(a.estimatedValue, b.estimatedValue);
            valueScore = (1.0 - (diff / maxV)) * VALUE_WEIGHT;
        }

        double locationScore = 0.0;
        if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) {
            double km = HaversineDistanceCalculator.distanceKm(a.lat, a.lon, b.lat, b.lon);
            if (km <= 5) locationScore = 0.20;
            else if (km <= 20) locationScore = 0.15;
            else if (km <= 50) locationScore = 0.10;
            else if (km <= 100) locationScore = 0.05;
        }

        return categoryScore + tagScore + valueScore + locationScore;
    }

    public static void main(String[] args) {
        Item i1 = new Item("A", "Electronics", List.of("phone", "android"), 300.0, 37.78, -122.43);
        Item i2 = new Item("B", "Electronics", List.of("phone", "ios"), 320.0, 37.77, -122.42);
        System.out.println("Basic score: " + score(i1, i2));
    }
}



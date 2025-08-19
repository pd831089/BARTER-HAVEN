package com.barterhaven.algorithms;

import java.time.*;
import java.util.*;

public final class EnhancedMatchScorer {
    public enum Condition { NEW, LIKE_NEW, GOOD, FAIR, POOR }

    public static final class Item {
        public final String id;
        public final String category;
        public final List<String> tags;
        public final Double estimatedValue;
        public final Double lat;
        public final Double lon;
        public final Condition condition;
        public final Integer popularityScore;
        public final Instant createdAt;

        public Item(String id, String category, List<String> tags, Double estimatedValue, Double lat, Double lon,
                    Condition condition, Integer popularityScore, Instant createdAt) {
            this.id = id; this.category = category; this.tags = tags == null ? List.of() : List.copyOf(tags);
            this.estimatedValue = estimatedValue; this.lat = lat; this.lon = lon;
            this.condition = condition; this.popularityScore = popularityScore; this.createdAt = createdAt;
        }
    }

    public static final class UserTradeStats {
        public final Map<String, Integer> categoryPreferences = new HashMap<>();
        public double minPrefValue = 0.0;
        public double maxPrefValue = 1_000_000.0;
    }

    public static final class ScoreWithReasons {
        public final double score; public final Map<String, String> reasons;
        public ScoreWithReasons(double score, Map<String, String> reasons) { this.score = score; this.reasons = reasons; }
        @Override public String toString() { return "score=" + score + " reasons=" + reasons; }
    }

    private EnhancedMatchScorer() {}

    public static ScoreWithReasons score(Item a, Item b, UserTradeStats statsOrNull) {
        double total = 0.0; Map<String, String> reasons = new LinkedHashMap<>();

        if (Objects.equals(a.category, b.category)) { total += 0.25; reasons.put("category", "Items are in the same category"); }

        double tagScore = 0.0;
        if (!a.tags.isEmpty() && !b.tags.isEmpty()) {
            Set<String> A = new HashSet<>(a.tags), B = new HashSet<>(b.tags);
            A.retainAll(B);
            int denom = Math.max(a.tags.size(), b.tags.size());
            if (denom > 0) tagScore = (A.size() / (double) denom) * 0.15;
            if (tagScore > 0.0) reasons.put("tags", "Items share " + Math.round((tagScore / 0.15) * 100) + "% of tags");
        }
        total += tagScore;

        if (a.estimatedValue != null && b.estimatedValue != null && a.estimatedValue > 0 && b.estimatedValue > 0) {
            double diff = Math.abs(a.estimatedValue - b.estimatedValue);
            double maxV = Math.max(a.estimatedValue, b.estimatedValue);
            double v = (1.0 - (diff / maxV)) * 0.15; total += v;
            if (v > 0.10) reasons.put("value", "Items have similar estimated values");
        }

        if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) {
            double km = HaversineDistanceCalculator.distanceKm(a.lat, a.lon, b.lat, b.lon);
            double loc = 0.0; String desc = null;
            if (km <= 5) { loc = 0.10; desc = "Items are very close (within 5km)"; }
            else if (km <= 20) { loc = 0.07; desc = "Items are nearby (within 20km)"; }
            else if (km <= 50) { loc = 0.05; desc = "Items are in the same region"; }
            else if (km <= 100) { loc = 0.02; desc = "Items are within 100km"; }
            total += loc; if (desc != null) reasons.put("location", desc);
        }

        if (a.condition != null && b.condition != null) {
            if (a.condition == b.condition) { total += 0.10; reasons.put("condition", "Items are in similar condition"); }
            else if (isComparableCondition(a.condition, b.condition)) { total += 0.05; reasons.put("condition", "Items are in comparable condition"); }
        }

        int popA = Optional.ofNullable(a.popularityScore).orElse(0);
        int popB = Optional.ofNullable(b.popularityScore).orElse(0);
        double pop = Math.min((popA + popB) / 100.0, 0.10); total += pop;
        if (pop > 0.05) reasons.put("popularity", "Both items are popular");

        if (a.createdAt != null && b.createdAt != null) {
            long days = Math.abs(Duration.between(a.createdAt, b.createdAt).toDays());
            if (days <= 30) { total += 0.05; reasons.put("age", "Items were listed around the same time"); }
        }

        if (statsOrNull != null && b.category != null && statsOrNull.categoryPreferences.containsKey(b.category)) {
            total += 0.05; reasons.put("preference", "Matches your trading preferences");
        }

        return new ScoreWithReasons(total, reasons);
    }

    private static boolean isComparableCondition(Condition a, Condition b) {
        Set<Condition> high = EnumSet.of(Condition.NEW, Condition.LIKE_NEW);
        Set<Condition> mid = EnumSet.of(Condition.GOOD, Condition.FAIR);
        return (high.contains(a) && high.contains(b)) || (mid.contains(a) && mid.contains(b));
    }

    public static void main(String[] args) {
        Item a = new Item("A", "Books", List.of("fiction", "classic"), 20.0, 37.78, -122.43,
                Condition.GOOD, 60, Instant.now());
        Item b = new Item("B", "Books", List.of("classic", "literature"), 22.0, 37.79, -122.44,
                Condition.FAIR, 55, Instant.now().minus(Duration.ofDays(10)));
        UserTradeStats stats = new UserTradeStats();
        stats.categoryPreferences.put("Books", 3);
        System.out.println(score(a, b, stats));
    }
}



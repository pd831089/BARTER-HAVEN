package com.barterhaven.operations;

import com.barterhaven.algorithms.EnhancedMatchScorer;
import com.barterhaven.algorithms.HaversineDistanceCalculator;

import java.time.*;
import java.util.*;
import java.util.stream.*;

public final class MatchingEngine {
    public static final class Item {
        public final String id; public String title; public String ownerName; public Double value; public Double lat; public Double lon;
        public EnhancedMatchScorer.Condition condition; public List<String> tags; public String category; public int popularity; public Instant createdAt; public String ownerId; public String imageUrl;
        public Item(String id) { this.id = id; }
    }
    public static final class MatchResult {
        public String matchedItemId; public double matchScore; public Double distanceKm; public String itemTitle; public String ownerName; public Double estimatedValue; public Map<String,String> reasons = new LinkedHashMap<>();
    }

    private MatchingEngine() {}

    public static List<MatchResult> findPotentialMatches(Item source, List<Item> candidates, double minScore, int limit, EnhancedMatchScorer.UserTradeStats stats) {
        return candidates.stream()
                .filter(i -> !Objects.equals(i.id, source.id))
                .map(i -> {
                    EnhancedMatchScorer.ScoreWithReasons s = EnhancedMatchScorer.score(
                            toEnhanced(source), toEnhanced(i), stats);
                    MatchResult r = new MatchResult();
                    r.matchedItemId = i.id; r.matchScore = s.score; r.itemTitle = i.title; r.ownerName = i.ownerName; r.estimatedValue = i.value; r.reasons = s.reasons;
                    if (source.lat != null && source.lon != null && i.lat != null && i.lon != null) {
                        r.distanceKm = HaversineDistanceCalculator.distanceKm(source.lat, source.lon, i.lat, i.lon);
                    }
                    return r;
                })
                .filter(r -> r.matchScore >= minScore)
                .sorted(Comparator.<MatchResult>comparingDouble(m -> -m.matchScore)
                        .thenComparing(m -> Optional.ofNullable(m.distanceKm).orElse(Double.MAX_VALUE)))
                .limit(limit)
                .collect(Collectors.toList());
    }

    private static EnhancedMatchScorer.Item toEnhanced(Item it) {
        return new EnhancedMatchScorer.Item(
                it.id, it.category, it.tags, it.value, it.lat, it.lon,
                it.condition, it.popularity, it.createdAt);
    }

    public static void main(String[] args) {
        Item a = new Item("A");
        a.category = "Books"; a.tags = List.of("classic"); a.value = 20.0; a.lat = 37.78; a.lon = -122.43;
        a.condition = EnhancedMatchScorer.Condition.GOOD; a.popularity = 50; a.createdAt = Instant.now();

        Item b = new Item("B");
        b.category = "Books"; b.tags = List.of("classic", "rare"); b.value = 22.0; b.lat = 37.79; b.lon = -122.44;
        b.condition = EnhancedMatchScorer.Condition.FAIR; b.popularity = 60; b.createdAt = Instant.now().minus(Duration.ofDays(5)); b.title = "Rare Classic"; b.ownerName = "User X";

        List<MatchResult> results = findPotentialMatches(a, List.of(b), 0.3, 10, new EnhancedMatchScorer.UserTradeStats());
        System.out.println(results.get(0).matchScore + " " + results.get(0).reasons);
    }
}



package com.barterhaven.operations;

import com.barterhaven.algorithms.EnhancedMatchScorer;

import java.time.*;
import java.util.*;

public final class MatchingOperations {
    private MatchingOperations() {}

    public static List<MatchingEngine.MatchResult> findMatches(MatchingEngine.Item source, List<MatchingEngine.Item> all, double minScore, int limit, EnhancedMatchScorer.UserTradeStats stats) {
        return MatchingEngine.findPotentialMatches(source, all, minScore, limit, stats);
    }

    public static void main(String[] args) {
        MatchingEngine.Item source = new MatchingEngine.Item("A"); source.category="Books"; source.tags=List.of("classic"); source.value=20.0; source.lat=37.78; source.lon=-122.43; source.condition=EnhancedMatchScorer.Condition.GOOD; source.createdAt=Instant.now();
        MatchingEngine.Item cand = new MatchingEngine.Item("B"); cand.category="Books"; cand.tags=List.of("classic"); cand.value=21.0; cand.lat=37.79; cand.lon=-122.44; cand.condition=EnhancedMatchScorer.Condition.LIKE_NEW; cand.createdAt=Instant.now().minusSeconds(3600); cand.ownerName="User X"; cand.title="Book";
        System.out.println(findMatches(source, List.of(cand), 0.3, 10, new EnhancedMatchScorer.UserTradeStats()).size());
    }
}



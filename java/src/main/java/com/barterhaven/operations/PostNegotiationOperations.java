package com.barterhaven.operations;

import java.time.*;
import java.util.*;

public final class PostNegotiationOperations {
    public static final class Trade { public String id; public String proposerId; public String receiverId; public String status; public Instant createdAt=Instant.now(); public Instant updatedAt=Instant.now(); public String offeredItemId; public String requestedItemId; }
    public static final class TradeDetails { public String tradeId; public String deliveryMethod; public String meetupLocation; public Instant meetupDateTime; public String shippingAddress; public String trackingNumber; public Map<String,String> contactInfo; public String notes; public Double lat; public Double lon; }
    public static final class TradeReview { public String id; public String tradeId; public String reviewerId; public String reviewedUserId; public int rating; public String comment; public Instant createdAt=Instant.now(); }
    public static final class TradeDispute { public String id; public String tradeId; public String reportedBy; public String reason; public String description; public List<String> evidenceUrls = new ArrayList<>(); public String status="open"; public Instant createdAt=Instant.now(); }

    public interface TradeRepo { Optional<Trade> find(String id); void save(Trade t); List<Trade> findByUser(String userId); }
    public interface TradeDetailsRepo { Optional<TradeDetails> find(String tradeId); void upsert(TradeDetails d); }
    public interface TradeReviewRepo { void save(TradeReview r); List<TradeReview> findByTrade(String tradeId); List<TradeReview> findByUser(String userId); }
    public interface TradeDisputeRepo { void save(TradeDispute d); List<TradeDispute> findByTrade(String tradeId); List<TradeDispute> findByUser(String userId); }

    public static final class InMemoryTradeRepo implements TradeRepo {
        private final Map<String, Trade> map = new HashMap<>();
        public Optional<Trade> find(String id) { return Optional.ofNullable(map.get(id)); }
        public void save(Trade t) { t.updatedAt=Instant.now(); map.put(t.id, t); }
        public List<Trade> findByUser(String userId) { return map.values().stream().filter(t -> Objects.equals(t.proposerId,userId) || Objects.equals(t.receiverId,userId)).sorted(Comparator.comparing((Trade t)->t.createdAt).reversed()).toList(); }
    }
    public static final class InMemoryDetailsRepo implements TradeDetailsRepo { private final Map<String, TradeDetails> map = new HashMap<>(); public Optional<TradeDetails> find(String tradeId){ return Optional.ofNullable(map.get(tradeId)); } public void upsert(TradeDetails d){ map.put(d.tradeId,d);} }
    public static final class InMemoryReviewRepo implements TradeReviewRepo {
        private final Map<String, TradeReview> map = new LinkedHashMap<>();
        public void save(TradeReview r){ map.put(r.id, r); }
        public List<TradeReview> findByTrade(String tradeId){ return map.values().stream().filter(r->Objects.equals(r.tradeId,tradeId)).toList(); }
        public List<TradeReview> findByUser(String userId){ return map.values().stream().filter(r->Objects.equals(r.reviewerId,userId)||Objects.equals(r.reviewedUserId,userId)).sorted(Comparator.comparing((TradeReview r)->r.createdAt).reversed()).toList(); }
    }
    public static final class InMemoryDisputeRepo implements TradeDisputeRepo {
        private final Map<String, TradeDispute> map = new LinkedHashMap<>();
        public void save(TradeDispute d){ map.put(d.id,d); }
        public List<TradeDispute> findByTrade(String tradeId){ return map.values().stream().filter(x->Objects.equals(x.tradeId,tradeId)).sorted(Comparator.comparing((TradeDispute d)->d.createdAt).reversed()).toList(); }
        public List<TradeDispute> findByUser(String userId){ return map.values().stream().filter(x->Objects.equals(x.reportedBy,userId)).sorted(Comparator.comparing((TradeDispute d)->d.createdAt).reversed()).toList(); }
    }

    private PostNegotiationOperations() {}

    public static TradeDetails createDeliveryDetails(TradeDetailsRepo repo, String tradeId, TradeDetails input) { input.tradeId = tradeId; repo.upsert(input); return input; }
    public static Optional<TradeDetails> getDeliveryDetails(TradeDetailsRepo repo, String tradeId) { return repo.find(tradeId); }
    public static TradeDetails updateDeliveryDetails(TradeDetailsRepo repo, String tradeId, TradeDetails updates) { updates.tradeId = tradeId; repo.upsert(updates); return updates; }

    public static TradeReview submitTradeReview(TradeReviewRepo repo, String tradeId, String reviewerId, String reviewedUserId, int rating, String comment) { TradeReview r = new TradeReview(); r.id = UUID.randomUUID().toString(); r.tradeId = tradeId; r.reviewerId = reviewerId; r.reviewedUserId = reviewedUserId; r.rating = rating; r.comment = comment; repo.save(r); return r; }
    public static List<TradeReview> getTradeReviews(TradeReviewRepo repo, String tradeId) { return repo.findByTrade(tradeId); }
    public static List<TradeReview> getUserReviews(TradeReviewRepo repo, String userId) { return repo.findByUser(userId); }

    public static TradeDispute reportDispute(TradeDisputeRepo repo, String tradeId, String reportedBy, String reason, String description, List<String> evidenceUrls) { TradeDispute d = new TradeDispute(); d.id=UUID.randomUUID().toString(); d.tradeId=tradeId; d.reportedBy=reportedBy; d.reason=reason; d.description=description; if (evidenceUrls!=null) d.evidenceUrls=evidenceUrls; repo.save(d); return d; }
    public static List<TradeDispute> getTradeDisputes(TradeDisputeRepo repo, String tradeId){ return repo.findByTrade(tradeId); }
    public static List<TradeDispute> getUserDisputes(TradeDisputeRepo repo, String userId){ return repo.findByUser(userId); }

    public static List<Trade> getTradeHistory(TradeRepo repo, String userId, String status, Instant start, Instant end) {
        return repo.findByUser(userId).stream()
                .filter(t -> status == null || status.equals(t.status))
                .filter(t -> start == null || !t.createdAt.isBefore(start))
                .filter(t -> end == null || !t.createdAt.isAfter(end))
                .toList();
    }
    public static Map<String, Object> getTradeStats(TradeRepo repo, String userId) {
        List<Trade> trades = repo.findByUser(userId);
        long total = trades.size();
        long completed = trades.stream().filter(t -> "completed".equals(t.status)).count();
        long pending = trades.stream().filter(t -> "pending".equals(t.status)).count();
        long disputed = trades.stream().filter(t -> "disputed".equals(t.status)).count();
        long avgMs = (long) trades.stream().filter(t -> "completed".equals(t.status)).mapToLong(t -> Duration.between(t.createdAt, t.updatedAt).toMillis()).average().orElse(0);
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("total", total); m.put("completed", completed); m.put("pending", pending); m.put("disputed", disputed); m.put("averageCompletionMs", avgMs);
        return m;
    }

    public static void main(String[] args) {
        InMemoryTradeRepo tRepo = new InMemoryTradeRepo();
        InMemoryDetailsRepo dRepo = new InMemoryDetailsRepo();
        InMemoryReviewRepo rRepo = new InMemoryReviewRepo();
        InMemoryDisputeRepo sRepo = new InMemoryDisputeRepo();

        Trade t = new Trade(); t.id="T1"; t.proposerId="u1"; t.receiverId="u2"; t.status="pending"; t.offeredItemId="iA"; t.requestedItemId="iB"; tRepo.save(t);
        TradeDetails td = new TradeDetails(); td.deliveryMethod="meetup"; td.meetupLocation="Central Park"; createDeliveryDetails(dRepo, t.id, td);
        submitTradeReview(rRepo, t.id, "u1", "u2", 5, "Great trade!");
        reportDispute(sRepo, t.id, "u2", "item_not_received", "Did not receive item", List.of("url1","url2"));

        System.out.println(getDeliveryDetails(dRepo, t.id).isPresent());
        System.out.println(getTradeReviews(rRepo, t.id).size());
        System.out.println(getTradeDisputes(sRepo, t.id).size());
        System.out.println(getTradeStats(tRepo, "u1"));
    }
}



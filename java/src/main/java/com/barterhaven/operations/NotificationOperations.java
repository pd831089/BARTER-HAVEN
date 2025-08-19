package com.barterhaven.operations;

import java.time.*;
import java.util.*;
import java.util.stream.*;

public final class NotificationOperations {
    public static final class Notification { public final String id; public final String userId; public boolean read; public final Instant createdAt; public Notification(String id, String userId, boolean read){this.id=id; this.userId=userId; this.read=read; this.createdAt=Instant.now();} }
    public static final class Message { public final String id; public final String senderId; public final String receiverId; public boolean read; public boolean deleted; public Message(String id,String s,String r,boolean read,boolean del){this.id=id; this.senderId=s; this.receiverId=r; this.read=read; this.deleted=del;} }
    public interface NotificationRepository {
        void upsertPushToken(String userId, String token, String platform, String deviceType);
        List<Notification> findByUser(String userId, int limit, int offset);
        void save(Notification n); void delete(String id); void markRead(String id); void markAllRead(String userId);
        long countUnread(String userId);
    }
    public interface MessageRepository { long countUnreadMessages(String userId); }

    public static final class InMemoryNotifRepo implements NotificationRepository {
        private final Map<String, String> tokens = new HashMap<>();
        private final Map<String, Notification> map = new LinkedHashMap<>();
        public void upsertPushToken(String userId, String token, String platform, String deviceType) { tokens.put(userId, token); }
        public List<Notification> findByUser(String userId, int limit, int offset) {
            return map.values().stream().filter(n -> Objects.equals(n.userId, userId))
                    .sorted(Comparator.comparing((Notification n) -> n.createdAt).reversed())
                    .skip(offset).limit(limit).collect(Collectors.toList());
        }
        public void save(Notification n) { map.put(n.id, n); }
        public void delete(String id) { map.remove(id); }
        public void markRead(String id) { Optional.ofNullable(map.get(id)).ifPresent(n -> n.read = true); }
        public void markAllRead(String userId) { map.values().stream().filter(n->Objects.equals(n.userId,userId)).forEach(n->n.read=true); }
        public long countUnread(String userId) { return map.values().stream().filter(n -> Objects.equals(n.userId,userId) && !n.read).count(); }
    }
    public static final class InMemoryMsgRepo implements MessageRepository {
        private final List<Message> msgs = new ArrayList<>();
        public long countUnreadMessages(String userId) { return msgs.stream().filter(m -> Objects.equals(m.receiverId, userId) && !m.read && !m.deleted).count(); }
        public void add(Message m) { msgs.add(m); }
    }

    private NotificationOperations() {}

    public static int updateBadgeCount(String userId, NotificationRepository notifRepo, MessageRepository msgRepo) {
        long unreadNotifs = notifRepo.countUnread(userId);
        long unreadMsgs = msgRepo.countUnreadMessages(userId);
        return Math.toIntExact(unreadNotifs + unreadMsgs);
    }

    public static void main(String[] args) {
        InMemoryNotifRepo nRepo = new InMemoryNotifRepo();
        InMemoryMsgRepo mRepo = new InMemoryMsgRepo();
        nRepo.save(new Notification("n1", "u1", false));
        mRepo.add(new Message("m1", "u2", "u1", false, false));
        System.out.println(updateBadgeCount("u1", nRepo, mRepo));
        nRepo.markAllRead("u1");
        System.out.println(updateBadgeCount("u1", nRepo, mRepo));
    }
}



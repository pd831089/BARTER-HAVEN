package com.barterhaven.operations;

import java.time.*;
import java.util.*;
import java.util.stream.*;

public final class ChatOperations {
    public static final class Message {
        public final String id; public final String senderId; public final String receiverId; public final String content; public String type; public String tradeId;
        public final Instant createdAt = Instant.now(); public Instant readAt; public Instant deletedAt;
        public Message(String id, String s, String r, String content) { this.id=id; this.senderId=s; this.receiverId=r; this.content=content; this.type="text"; }
    }
    public interface MessageRepository {
        void save(Message m);
        List<Message> findConversation(String userA, String userB);
        void markRead(List<String> ids);
        void softDelete(String messageId, String userId);
        long countUnread(String userId);
    }
    public static final class InMemoryMessageRepo implements MessageRepository {
        private final Map<String, Message> map = new LinkedHashMap<>();
        public void save(Message m) { map.put(m.id, m); }
        public List<Message> findConversation(String a, String b) {
            return map.values().stream()
                    .filter(m -> (Objects.equals(m.senderId,a) && Objects.equals(m.receiverId,b)) ||
                                 (Objects.equals(m.senderId,b) && Objects.equals(m.receiverId,a)))
                    .filter(m -> m.deletedAt == null)
                    .sorted(Comparator.comparing(m -> m.createdAt))
                    .collect(Collectors.toList());
        }
        public void markRead(List<String> ids) { ids.forEach(id -> Optional.ofNullable(map.get(id)).ifPresent(m -> m.readAt = Instant.now())); }
        public void softDelete(String messageId, String userId) { Optional.ofNullable(map.get(messageId)).ifPresent(m -> m.deletedAt = Instant.now()); }
        public long countUnread(String userId) { return map.values().stream().filter(m -> Objects.equals(m.receiverId,userId) && m.readAt==null && m.deletedAt==null).count(); }
    }

    private ChatOperations() {}

    public static Message sendMessage(MessageRepository repo, String senderId, String receiverId, String content, String tradeId, String type) {
        Message m = new Message(UUID.randomUUID().toString(), senderId, receiverId, content);
        m.tradeId = tradeId; m.type = (type != null ? type : "text");
        repo.save(m);
        return m;
    }
    public static List<Message> getMessages(MessageRepository repo, String user, String other) {
        List<Message> msgs = repo.findConversation(user, other);
        List<String> unread = msgs.stream().filter(m -> Objects.equals(m.receiverId, user) && m.readAt == null).map(m -> m.id).collect(Collectors.toList());
        if (!unread.isEmpty()) repo.markRead(unread);
        return msgs;
    }
    public static long getUnreadCount(MessageRepository repo, String userId) { return repo.countUnread(userId); }

    public static void main(String[] args) {
        InMemoryMessageRepo repo = new InMemoryMessageRepo();
        sendMessage(repo, "u1", "u2", "Hello", null, "text");
        System.out.println(getUnreadCount(repo, "u2"));
        List<Message> conv = getMessages(repo, "u2", "u1");
        System.out.println("Conv size " + conv.size() + " unread after get: " + getUnreadCount(repo, "u2"));
    }
}



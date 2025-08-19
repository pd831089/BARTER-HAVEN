package com.barterhaven.algorithms;

import java.time.*;
import java.util.*;

public final class ChatUsersSorter {
    public static final class ChatUser {
        public final String id; public final String nameOrEmail; public final Instant lastMessageAt;
        public ChatUser(String id, String nameOrEmail, Instant lastMessageAt) { this.id = id; this.nameOrEmail = nameOrEmail; this.lastMessageAt = lastMessageAt; }
    }

    private ChatUsersSorter() {}

    public static void sort(List<ChatUser> users) {
        users.sort((a, b) -> {
            if (a.lastMessageAt != null && b.lastMessageAt == null) return -1;
            if (a.lastMessageAt == null && b.lastMessageAt != null) return 1;
            if (a.lastMessageAt != null && b.lastMessageAt != null) return b.lastMessageAt.compareTo(a.lastMessageAt);
            return a.nameOrEmail.compareToIgnoreCase(b.nameOrEmail);
        });
    }

    public static void main(String[] args) {
        List<ChatUser> users = new ArrayList<>();
        users.add(new ChatUser("1", "Zoe", Instant.now().minusSeconds(60)));
        users.add(new ChatUser("2", "Adam", null));
        users.add(new ChatUser("3", "Bella", Instant.now()));
        sort(users);
        users.forEach(u -> System.out.println(u.nameOrEmail));
    }
}



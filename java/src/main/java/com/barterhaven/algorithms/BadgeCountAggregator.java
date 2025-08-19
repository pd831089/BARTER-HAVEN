package com.barterhaven.algorithms;

import java.util.*;

public final class BadgeCountAggregator {
    public static final class Notification { public final boolean read; public Notification(boolean read){this.read=read;} }
    public static final class Message { public final String receiverId; public final boolean read; public final boolean deleted; public Message(String receiverId, boolean read, boolean deleted){this.receiverId=receiverId; this.read=read; this.deleted=deleted;} }

    private BadgeCountAggregator() {}

    public static int count(String userId, List<Notification> notifications, List<Message> messages) {
        int unreadNotifications = (int) notifications.stream().filter(n -> !n.read).count();
        int unreadMessages = (int) messages.stream().filter(m -> Objects.equals(m.receiverId, userId) && !m.read && !m.deleted).count();
        return unreadNotifications + unreadMessages;
    }

    public static void main(String[] args) {
        List<Notification> notifs = Arrays.asList(new Notification(false), new Notification(true));
        List<Message> msgs = Arrays.asList(new Message("u1", false, false), new Message("u1", true, false));
        System.out.println(count("u1", notifs, msgs));
    }
}



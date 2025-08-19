package com.barterhaven.algorithms;

public final class SimpleHash {
    private SimpleHash() {}

    public static int simpleHash(String input) {
        int hash = 0;
        for (char ch : input.toCharArray()) {
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash; // force 32-bit
        }
        return Math.abs(hash);
    }

    public static void main(String[] args) {
        System.out.println(simpleHash("123 Main St"));
    }
}



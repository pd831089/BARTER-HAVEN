package com.barterhaven.algorithms;

public final class HaversineDistanceCalculator {
    private static final double EARTH_RADIUS_KM = 6371.0;

    private HaversineDistanceCalculator() {}

    public static double distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        return EARTH_RADIUS_KM * c;
    }

    public static void main(String[] args) {
        double km = distanceKm(37.78825, -122.4324, 37.7749, -122.4194);
        System.out.println("Distance km: " + km);
    }
}



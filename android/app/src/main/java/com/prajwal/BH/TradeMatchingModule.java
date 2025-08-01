package com.prajwal.BH;

import com.facebook.react.bridge.*;

public class TradeMatchingModule extends ReactContextBaseJavaModule {
    public TradeMatchingModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "TradeMatching";
    }

    @ReactMethod
    public void findItemsWithinRadius(ReadableArray items, double userLat, double userLon, double radiusKm, Promise promise) {
        WritableArray filteredItems = Arguments.createArray();
        for (int i = 0; i < items.size(); i++) {
            ReadableMap item = items.getMap(i);
            if (!item.hasKey("latitude") || !item.hasKey("longitude")) continue;
            double itemLat = item.getDouble("latitude");
            double itemLon = item.getDouble("longitude");
            double distance = HaversineCalculator.calculate(userLat, userLon, itemLat, itemLon);
            if (distance <= radiusKm) {
                filteredItems.pushMap(item);
            }
        }
        promise.resolve(filteredItems);
    }
} 
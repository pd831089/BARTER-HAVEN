package com.prajwal.BH;

import android.annotation.SuppressLint;
import com.facebook.react.bridge.*;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;

public class LocationModule extends ReactContextBaseJavaModule {

    private final FusedLocationProviderClient fusedLocationClient;

    public LocationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(reactContext);
    }

    @Override
    public String getName() {
        return "LocationModule";
    }

    @ReactMethod
    @SuppressLint("MissingPermission") // Permissions are checked on the JS side
    public void getCurrentLocation(Promise promise) {
        fusedLocationClient.getLastLocation()
            .addOnSuccessListener(location -> {
                if (location != null) {
                    WritableMap map = Arguments.createMap();
                    map.putDouble("latitude", location.getLatitude());
                    map.putDouble("longitude", location.getLongitude());
                    promise.resolve(map);
                } else {
                    promise.reject("NO_LOCATION", "Last known location is not available.");
                }
            })
            .addOnFailureListener(e -> promise.reject("LOCATION_ERROR", "Failed to get location: " + e.getMessage()));
    }
} 
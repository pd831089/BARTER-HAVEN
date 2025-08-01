package com.prajwal.BH;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;
import androidx.annotation.Nullable;

public class ChatService extends Service {
    private static final String TAG = "ChatService";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Chat Service Created.");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Chat Service Started.");
        // This is where we will add message syncing logic later.
        // For now, it just runs in the background.
        return START_STICKY; // Ensures the service restarts if the OS kills it.
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Chat Service Destroyed.");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        // This is a started service, not a bound one, so we return null.
        return null;
    }
} 
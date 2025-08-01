package com.prajwal.BH;

import android.content.Intent;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class ChatModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public ChatModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "ChatModule";
    }

    @ReactMethod
    public void startChatService() {
        Intent serviceIntent = new Intent(reactContext, ChatService.class);
        reactContext.startService(serviceIntent);
    }

    @ReactMethod
    public void stopChatService() {
        Intent serviceIntent = new Intent(reactContext, ChatService.class);
        reactContext.stopService(serviceIntent);
    }
} 
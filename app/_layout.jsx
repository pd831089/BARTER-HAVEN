import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { UserDetailContext } from "@/context/UserDetailContext";
import { useState } from "react";
import { AuthProvider } from '@/Config/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';


export default function RootLayout() {
  useFonts({
    'outfit': require('./../assets/fonts/Outfit-Regular.ttf'),
    'outfit-medium': require('./../assets/fonts/Outfit-Medium.ttf'),
    'outfit-bold': require('./../assets/fonts/Outfit-Bold.ttf')
  })

  const [userDetail, setUserDetail] = useState();

  return (
    <AuthProvider>
      <NotificationProvider>
        <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index"
              options={{
                headerShown: false
              }} />
            <Stack.Screen name="auth/signIn"
              options={{
                headerShown: false
              }} />
            <Stack.Screen name="auth/signUp"
              options={{
                headerShown: false
              }} />
            <Stack.Screen name="(drawer)" />
          </Stack>
        </UserDetailContext.Provider>
      </NotificationProvider>
    </AuthProvider>
  );
}
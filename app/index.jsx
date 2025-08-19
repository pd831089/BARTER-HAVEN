import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router, useRouter } from 'expo-router';
import { useAuth } from '@/Config/AuthContext';
import { useState } from 'react';

export default function Index() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user && mounted) {
      router.replace('/(drawer)/(tabs)/home');
    }
  }, [user, mounted]);

  return (
    <View style={styles.container}>
      <View style={styles.logoCard}>
        <Image
          source={require('@/assets/images/BHlogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.subtitle}>Trade, Barter, Connect</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.signInButton]}
          onPress={() => router.push('/auth/signIn')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.signUpButton]}
          onPress={() => router.push('/auth/signUp')}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, styles.signUpText]}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  logoCard: {
    width: 210,
    height: 210,
    borderRadius: 48,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    elevation: 6,
    shadowColor: '#075eec',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
  },
  logo: {
    width: 180,
    height: 180,
    borderRadius: 40,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 36,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#075eec',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
  },
  signInButton: {
    backgroundColor: '#075eec',
  },
  signUpButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  signUpText: {
    color: '#2563eb',
  },
});

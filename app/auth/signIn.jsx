import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/Config/supabaseConfig';
import { useAuth } from '@/Config/AuthContext';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Sign In Failed', error.message);
    } else {
      router.replace('/(drawer)/(tabs)/home');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setShowResetModal(true)} style={{ alignSelf: 'center', marginTop: 8 }}>
        <Text style={{ color: '#075eec', textDecorationLine: 'underline', fontSize: 15 }}>Forgot Password?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/auth/signUp')}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>

      {/* Password Reset Modal */}
      <Modal visible={showResetModal} animationType="slide" transparent onRequestClose={() => setShowResetModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Reset Password</Text>
            <Text style={{ marginBottom: 8, color: '#374151' }}>Enter your email to receive a password reset link.</Text>
            <TextInput
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 10, marginBottom: 12 }}
            />
            {resetMessage ? <Text style={{ color: resetMessage.startsWith('Error') ? '#EF4444' : '#10B981', marginBottom: 8 }}>{resetMessage}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setShowResetModal(false)} style={{ marginRight: 16 }}>
                <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setResetLoading(true);
                  setResetMessage('');
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);
                    if (error) throw error;
                    setResetMessage('Password reset email sent!');
                  } catch (err) {
                    setResetMessage('Error: ' + (err.message || 'Failed to send reset email.'));
                  } finally {
                    setResetLoading(false);
                  }
                }}
                disabled={resetLoading || !resetEmail}
                style={{ backgroundColor: '#075eec', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{resetLoading ? 'Sending...' : 'Send Email'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#075eec',
    marginBottom: 32,
  },
  input: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
    backgroundColor: '#f9f9f9',
    color: '#222',
  },
  button: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#075eec',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  linkText: {
    color: '#075eec',
    fontSize: 15,
    marginTop: 8,
  },
});
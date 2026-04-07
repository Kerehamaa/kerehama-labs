import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = () => {
    if (!login(password)) {
      setError('Wrong password');
      setPassword('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.box}>
        <Text style={styles.title}>
          Admin <Text style={styles.accent}>Login</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.muted + '80'}
          secureTextEntry
          value={password}
          onChangeText={(t) => { setPassword(t); setError(''); }}
          onSubmitEditing={handleLogin}
          autoFocus
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Enter →</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>Kerehama Labs</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.fg,
    marginBottom: 8,
  },
  accent: {
    color: theme.accent,
  },
  input: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.bgSoft,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    color: theme.fg,
    fontSize: 16,
  },
  error: {
    color: theme.danger,
    fontSize: 14,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  buttonText: {
    color: theme.fg,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    color: theme.muted,
    fontSize: 13,
    opacity: 0.5,
    marginTop: 16,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Kerehama Labs</Text>
        <Text style={styles.sub}>Admin App v1.0</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Connected to</Text>
        <Text style={styles.value}>labs.kerehama.nz</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: theme.bgSoft,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  title: {
    color: theme.fg,
    fontSize: 20,
    fontWeight: '600',
  },
  sub: {
    color: theme.muted,
    fontSize: 14,
    marginTop: 4,
  },
  label: {
    color: theme.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  value: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '500',
  },
  logoutBtn: {
    padding: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.danger,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: theme.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});

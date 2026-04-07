import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl,
} from 'react-native';
import { theme } from '../theme';
import { supabase } from '../lib/supabase';

function timeAgo(ts) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function displayName(chat) {
  return chat.display_name || chat.client_name;
}

export default function ChatsScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = useCallback(async () => {
    const { data } = await supabase
      .from('chats')
      .select('*')
      .order('last_message_at', { ascending: false });
    setChats(data || []);
  }, []);

  useEffect(() => {
    loadChats();

    const channel = supabase
      .channel('chats-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        loadChats();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadChats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadChats]);

  // Refresh on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadChats);
    return unsubscribe;
  }, [navigation, loadChats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  const filtered = search
    ? chats.filter(c =>
        [c.client_name, c.display_name, c.client_email, ...(c.tags || [])]
          .some(v => (v || '').toLowerCase().includes(search.toLowerCase()))
      )
    : chats;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, name: displayName(item) })}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{displayName(item)}</Text>
          {item.display_name ? (
            <Text style={styles.alias}> ({item.client_name})</Text>
          ) : null}
        </View>
        <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text>
      </View>
      <Text style={styles.email}>{item.client_email}</Text>
      {item.tags?.length ? (
        <View style={styles.tags}>
          {item.tags.map((t, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats…"
          placeholderTextColor={theme.muted + '60'}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>{search ? 'No matches' : 'No chats yet'}</Text>
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  searchBox: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
    backgroundColor: theme.bgSoft,
  },
  searchInput: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    color: theme.fg,
    fontSize: 14,
  },
  chatItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  name: { color: theme.fg, fontWeight: '600', fontSize: 15 },
  alias: { color: theme.accent, fontSize: 12 },
  email: { color: theme.muted, fontSize: 13, marginTop: 2 },
  time: { color: theme.muted, fontSize: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tagText: { color: theme.accent, fontSize: 11, fontWeight: '600' },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
});

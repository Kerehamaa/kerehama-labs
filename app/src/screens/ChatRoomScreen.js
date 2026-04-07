import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { theme } from '../theme';
import { supabase } from '../lib/supabase';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatRoomScreen({ route }) {
  const { chatId, name } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`room-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const sendMessage = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');

    const { error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, sender: 'admin', content: msg });

    if (!error) {
      await supabase
        .from('chats')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', chatId);
    }
    setSending(false);
  };

  const renderMessage = ({ item }) => {
    // Hide summaries
    if (item.content?.startsWith('__SUMMARY__')) return null;

    // Render cards
    if (item.content?.startsWith('__CARD__')) {
      try {
        const card = JSON.parse(item.content.replace('__CARD__', ''));
        return (
          <View style={[styles.msg, styles.cardMsg]}>
            {card.title ? <Text style={styles.cardTitle}>{card.title}</Text> : null}
            {card.desc ? <Text style={styles.cardDesc}>{card.desc}</Text> : null}
            {card.buttons?.length ? (
              <View style={styles.cardButtons}>
                {card.buttons.map((b, i) => (
                  <View key={i} style={styles.cardBtn}>
                    <Text style={styles.cardBtnText}>{b.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.metaLeft}>Card · {formatTime(item.created_at)}</Text>
          </View>
        );
      } catch (e) { return null; }
    }

    const isAdmin = item.sender === 'admin';
    return (
      <View style={[styles.msg, isAdmin ? styles.adminMsg : styles.clientMsg]}>
        <Text style={[styles.msgText, isAdmin && styles.adminMsgText]}>
          {item.content}
        </Text>
        <Text style={[styles.meta, isAdmin ? styles.metaAdmin : styles.metaLeft]}>
          {isAdmin ? 'You' : name} · {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet</Text>
        }
      />
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Reply as Kerehama…"
          placeholderTextColor={theme.muted + '60'}
          value={text}
          onChangeText={setText}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  messagesList: { padding: 16, paddingBottom: 8 },
  msg: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  clientMsg: {
    alignSelf: 'flex-start',
    backgroundColor: theme.bgSoft,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderBottomLeftRadius: 4,
  },
  adminMsg: {
    alignSelf: 'flex-end',
    backgroundColor: theme.accent,
    borderBottomRightRadius: 4,
  },
  msgText: { color: theme.fg, fontSize: 15, lineHeight: 22 },
  adminMsgText: { color: '#050505' },
  meta: { fontSize: 11, marginTop: 4, opacity: 0.6 },
  metaLeft: { color: theme.muted, fontSize: 11, marginTop: 4 },
  metaAdmin: { color: '#050505', fontSize: 11, marginTop: 4, opacity: 0.6 },
  cardMsg: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: theme.bgSoft,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  cardTitle: { color: theme.fg, fontWeight: '600', fontSize: 16 },
  cardDesc: { color: theme.muted, fontSize: 14, marginTop: 4 },
  cardButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  cardBtn: {
    backgroundColor: theme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cardBtnText: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 40, opacity: 0.5 },
  inputBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
    backgroundColor: theme.bgSoft,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    color: theme.fg,
    fontSize: 15,
  },
  sendBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.accent,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#050505', fontWeight: '600', fontSize: 15 },
});

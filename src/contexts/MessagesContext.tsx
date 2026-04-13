'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { type MockConversation, type MockMessage } from '@/services/mock/conversations';

interface MessagesContextValue {
  conversations: MockConversation[];
  loading: boolean;
  unreadCount: number;
  send: (convId: string, text: string) => Promise<void>;
  markRead: (convId: string) => Promise<void>;
}

const MessagesContext = createContext<MessagesContextValue | undefined>(undefined);

type ConversationRow = {
  id: string;
  name: string;
  role: string | null;
  avatar: string | null;
  initials: string | null;
  type: 'active' | 'hired' | null;
  last_message: string | null;
  time: string | null;
  unread: number | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  from_me: boolean | null;
  text: string;
  time: string | null;
};

function rowToMsg(r: MessageRow): MockMessage {
  return {
    id: r.id,
    fromMe: r.from_me ?? false,
    text: r.text,
    time: r.time ?? '',
  };
}

function rowToConv(r: ConversationRow, messages: MockMessage[]): MockConversation {
  return {
    id: r.id,
    name: r.name,
    role: r.role ?? '',
    avatar: r.avatar ?? undefined,
    initials: r.initials ?? '',
    type: (r.type ?? 'active') as MockConversation['type'],
    lastMessage: r.last_message ?? '',
    time: r.time ?? '',
    unread: r.unread ?? 0,
    messages,
  };
}

export function MessagesProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<MockConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ data: convRows, error: cErr }, { data: msgRows, error: mErr }] = await Promise.all([
        supabase.from('conversations').select('*').order('updated_at', { ascending: false }),
        supabase.from('messages').select('*').order('created_at', { ascending: true }),
      ]);

      if (cancelled) return;

      if (cErr) console.error('[conversations] load failed', cErr);
      if (mErr) console.error('[messages] load failed', mErr);

      if (convRows) {
        const msgsByConv = new Map<string, MockMessage[]>();
        (msgRows as MessageRow[] | null)?.forEach((m) => {
          const arr = msgsByConv.get(m.conversation_id) ?? [];
          arr.push(rowToMsg(m));
          msgsByConv.set(m.conversation_id, arr);
        });
        setConversations(
          (convRows as ConversationRow[]).map((c) => rowToConv(c, msgsByConv.get(c.id) ?? [])),
        );
      }

      setLoading(false);
    })();

    const convChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as ConversationRow;
            setConversations((prev) =>
              prev.some((c) => c.id === row.id) ? prev : [rowToConv(row, []), ...prev],
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as ConversationRow;
            setConversations((prev) =>
              prev.map((c) => (c.id === row.id ? rowToConv(row, c.messages) : c)),
            );
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string };
            setConversations((prev) => prev.filter((c) => c.id !== old.id));
          }
        },
      )
      .subscribe();

    const msgChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as MessageRow;
            setConversations((prev) =>
              prev.map((c) =>
                c.id === row.conversation_id && !c.messages.some((m) => m.id === row.id)
                  ? { ...c, messages: [...c.messages, rowToMsg(row)] }
                  : c,
              ),
            );
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as MessageRow;
            setConversations((prev) =>
              prev.map((c) =>
                c.id === row.conversation_id
                  ? {
                      ...c,
                      messages: c.messages.map((m) => (m.id === row.id ? rowToMsg(row) : m)),
                    }
                  : c,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string; conversation_id: string };
            setConversations((prev) =>
              prev.map((c) =>
                c.id === old.conversation_id
                  ? { ...c, messages: c.messages.filter((m) => m.id !== old.id) }
                  : c,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
    };
  }, []);

  const send = useCallback<MessagesContextValue['send']>(async (convId, text) => {
    const msg: MockMessage = {
      id: `m${Date.now()}`,
      fromMe: true,
      text,
      time: 'Just now',
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, lastMessage: text, time: 'Just now', messages: [...c.messages, msg] }
          : c,
      ),
    );

    const { error: msgErr } = await supabase.from('messages').insert({
      id: msg.id,
      conversation_id: convId,
      from_me: true,
      text,
      time: 'Just now',
    });
    if (msgErr) console.error('[messages] insert failed', msgErr);

    const { error: convErr } = await supabase
      .from('conversations')
      .update({ last_message: text, time: 'Just now', updated_at: new Date().toISOString() })
      .eq('id', convId);
    if (convErr) console.error('[conversations] update failed', convErr);
  }, []);

  const markRead = useCallback<MessagesContextValue['markRead']>(async (convId) => {
    setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, unread: 0 } : c)));
    const { error } = await supabase.from('conversations').update({ unread: 0 }).eq('id', convId);
    if (error) console.error('[conversations] markRead failed', error);
  }, []);

  const unreadCount = conversations.reduce((s, c) => s + c.unread, 0);

  const value = useMemo(
    () => ({ conversations, loading, unreadCount, send, markRead }),
    [conversations, loading, unreadCount, send, markRead],
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used within MessagesProvider');
  return ctx;
}

import { useState, useRef } from 'react';
import { View, Text, Textarea, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { PersonalEntry } from '@pengtou/contracts';
import { request, message } from '../lib/api';
export function SessionNote({ sid, title }: { sid: string; title: string }) {
  const key = 'qinggai:session-note-draft:' + sid;
  const [notes, setNotes] = useState(() =>
    String(Taro.getStorageSync(key) || ''),
  );
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const entry = useRef<{ id: string; version: number } | null>(null);
  async function save() {
    if (busy || !notes.trim()) return;
    setBusy(true);
    entry.current ||= {
      id: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      }),
      version: 0,
    };
    try {
      const r = await request<PersonalEntry>(
        entry.current.version
          ? `/me/entries/${entry.current.id}`
          : '/me/entries',
        entry.current.version ? 'PATCH' : 'POST',
        {
          ...(entry.current.version ? {} : { id: entry.current.id }),
          title,
          occurredAt: new Date().toISOString(),
          notes,
          location: '',
          category: '',
          people: [],
          sessionId: sid,
          ...(entry.current.version ? { version: entry.current.version } : {}),
        },
      );
      entry.current = { id: r.id, version: r.version };
      Taro.removeStorageSync(key);
      setStatus('已保存，只有你可见');
    } catch (e) {
      setStatus(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="card">
      <Text className="row-title">记下这一刻</Text>
      <Textarea
        className="note-input"
        placeholder="聊到了什么？有什么想留下来…"
        value={notes}
        maxlength={20000}
        onInput={(e) => {
          setNotes(e.detail.value);
          Taro.setStorageSync(key, e.detail.value);
          setStatus('');
        }}
      />
      <Button
        className="row-button button"
        disabled={busy || !notes.trim()}
        onClick={() => void save()}
      >
        {busy ? '正在保存…' : '保存我的心得'}
      </Button>
      {status && <Text className="hint">{status}</Text>}
    </View>
  );
}

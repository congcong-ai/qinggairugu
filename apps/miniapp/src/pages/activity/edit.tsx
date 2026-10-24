import { localDateInput, dateInputToISOString } from '@pengtou/shared';
import { useState } from 'react';
import { View, Text, Input, Textarea, Button } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import type { PersonalEntry } from '@pengtou/contracts';
import { login, request, message } from '../../lib/api';
import { AppGuide } from '../../components/app-guide';
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
export default function Entry() {
  const [id, setId] = useState('');
  const [version, setVersion] = useState(0);
  const [sid, setSid] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateInput());
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [people, setPeople] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useLoad((options) => {
    const eid = options.id || uuid();
    setId(eid);
    setSid(options.sid || null);
    if (options.id)
      void login()
        .then(() => request<PersonalEntry>(`/me/entries/${eid}`))
        .then((r) => {
          setVersion(r.version);
          setTitle(r.title);
          setDate(localDateInput(new Date(r.occurredAt)));
          setLocation(r.location);
          setCategory(r.category);
          setNotes(r.notes);
          setPeople(
            r.people
              .map((p) => p.name + (p.note ? '：' + p.note : ''))
              .join('\n'),
          );
          setSid(r.sessionId);
        })
        .catch((e) => setError(message(e)));
  });
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await login();
      const parsedPeople = people
        .split('\n')
        .filter((x) => x.trim())
        .map((x) => {
          const [name, ...rest] = x.split('：');
          return { name: name!.trim(), note: rest.join('：') };
        });
      const occurredAt = dateInputToISOString(date);
      const payload = {
        title:
          title.trim() || `${new Date(occurredAt).toLocaleDateString()} 的活动`,
        occurredAt,
        location,
        category,
        notes,
        people: parsedPeople,
        sessionId: sid,
      };
      const r = await request<PersonalEntry>(
        version ? `/me/entries/${id}` : '/me/entries',
        version ? 'PATCH' : 'POST',
        version ? { ...payload, version } : { ...payload, id },
      );
      setVersion(r.version);
      setTitle(r.title);
      setError('已保存，只有你可见');
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !(
        await Taro.showModal({
          title: '删除我的记录？',
          content:
            '删除这份文字心得，不影响 App 本地照片、他人记录和共享活动。',
        })
      ).confirm
    )
      return;
    try {
      await request(`/me/entries/${id}`, 'DELETE');
      await Taro.navigateBack();
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <View className="page">
      <Text className="eyebrow">我的记录 · 只有我可见</Text>
      <Text className="title">记住这次相聚</Text>
      <View className="card">
        <Input
          className="field"
          placeholder="活动名称（可选）"
          value={title}
          maxlength={120}
          onInput={(e) => setTitle(e.detail.value)}
        />
        <Input
          className="field"
          placeholder="时间，例如 2026-10-22"
          value={date}
          onInput={(e) => setDate(e.detail.value)}
        />
        <Input
          className="field"
          placeholder="在哪里（可选）"
          value={location}
          onInput={(e) => setLocation(e.detail.value)}
        />
        <Input
          className="field"
          placeholder="分类（可选）"
          value={category}
          onInput={(e) => setCategory(e.detail.value)}
        />
        <Textarea
          autoHeight
          maxlength={20000}
          placeholder="今天有什么想记住的？"
          value={notes}
          onInput={(e) => setNotes(e.detail.value)}
        />
        <Textarea
          autoHeight
          maxlength={20000}
          placeholder="认识的人，每行一位：名字：备注"
          value={people}
          onInput={(e) => setPeople(e.detail.value)}
        />
      </View>
      {error && <Text className="hint">{error}</Text>}
      <Button className="button" disabled={busy} onClick={() => void save()}>
        保存这次记忆
      </Button>
      <AppGuide />
      {sid && (
        <Button
          disabled={busy}
          onClick={() => {
            setSid(null);
            setError('已解除关联，点击保存后生效；这份私人内容仍保留。');
          }}
        >
          解除与共享活动的关联
        </Button>
      )}
      {!!version && (
        <Button disabled={busy} onClick={() => void remove()}>
          删除我的记录
        </Button>
      )}
    </View>
  );
}

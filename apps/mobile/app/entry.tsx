import { localDateInput, dateInputToISOString } from '@pengtou/shared';
import { persistPhoto } from '../src/persist-photo';
import { LocalMediaNotice } from '../src/local-media-notice';
import { useState, useEffect, useRef } from 'react';
import { Text, TextInput, Alert, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';
import { Page, Heading, Card, Action, styles } from '../src/ui';
import { getDatabase } from '../src/storage/database';
import { bindingStatus, cloudRequest } from '../src/cloud';
import type { PersonalEntry } from '@pengtou/contracts';
export default function Entry() {
  const params = useLocalSearchParams<{ id?: string; cloudEntryId?: string }>();
  const [id, setId] = useState(params.id ?? randomUUID());
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateInput());
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [people, setPeople] = useState('');
  const [photos, setPhotos] = useState<
    {
      id: string;
      uri: string;
    }[]
  >([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const photoLock = useRef(false);
  useEffect(() => {
    void (async () => {
      const db = await getDatabase();
      if (params.cloudEntryId) {
        const b = await bindingStatus();
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM personal_entries WHERE cloud_entry_id=? AND cloud_owner_id=?',
          params.cloudEntryId,
          b.userId,
        );
        if (existing && existing.id !== id) {
          setId(existing.id);
          return;
        }
        const e = await cloudRequest<PersonalEntry>(
          `/me/entries/${params.cloudEntryId}`,
        );
        await db.runAsync(
          "INSERT OR IGNORE INTO sessions(id,title,state,created_at,updated_at,cloud_id) VALUES(?,?,'ready',?,?,?)",
          id,
          e.title,
          new Date().toISOString(),
          new Date().toISOString(),
          e.sessionId,
        );
        await db.runAsync(
          'INSERT INTO personal_entries(id,notes,people,occurred_at,location,category,cloud_entry_id,cloud_version,cloud_owner_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
          id,
          e.notes,
          JSON.stringify(e.people),
          e.occurredAt,
          e.location,
          e.category,
          e.id,
          e.version,
          b.userId,
        );
      }
      const row = await db.getFirstAsync<{
        title: string;
        notes: string | null;
        people: string | null;
        occurred_at: string | null;
        location: string | null;
        category: string | null;
      }>(
        'SELECT s.title,e.notes,e.people,e.occurred_at,e.location,e.category FROM sessions s LEFT JOIN personal_entries e ON e.id=s.id WHERE s.id=?',
        id,
      );
      if (row) {
        setTitle(row.title);
        setNotes(row.notes ?? '');
        setPeople(
          (JSON.parse(row.people ?? '[]') as { name: string; note: string }[])
            .map((p) => p.name + (p.note ? '：' + p.note : ''))
            .join('\n'),
        );
        setDate(
          localDateInput(new Date(row.occurred_at ?? new Date().toISOString())),
        );
        setLocation(row.location ?? '');
        setCategory(row.category ?? '');
      }
      setPhotos(
        await db.getAllAsync(
          'SELECT * FROM personal_photos WHERE session_id=?',
          id,
        ),
      );
    })().catch((e) => setStatus(e.message));
  }, [id, params.cloudEntryId]);
  const personValues = () =>
    people
      .split('\n')
      .filter((x) => x.trim())
      .map((v) => {
        const [name, ...rest] = v.split('：');
        return { name: name!.trim(), note: rest.join('：') };
      });
  async function save() {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const occurred = dateInputToISOString(date);
    const name =
      title.trim() ||
      `${new Date(occurred).toLocaleDateString('zh-CN')} 的活动`;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES(?,?,'ready',?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at",
        id,
        name,
        now,
        now,
      );
      await tx.runAsync(
        'INSERT INTO personal_entries(id,notes,people,occurred_at,location,category) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET notes=excluded.notes,people=excluded.people,occurred_at=excluded.occurred_at,location=excluded.location,category=excluded.category',
        id,
        notes,
        JSON.stringify(personValues()),
        occurred,
        location,
        category,
      );
    });
    setTitle(name);
    setStatus('已保存在本机');
    return { db, name, occurred };
  }
  async function saveCloud() {
    if (busy) return;
    setBusy(true);
    try {
      const { db, name, occurred } = await save();
      const b = await bindingStatus();
      if (!b.userId) throw new Error('请先在「我的」关联小程序');
      const current = await db.getFirstAsync<{
        cloud_entry_id: string | null;
        cloud_version: number;
        cloud_owner_id: string | null;
      }>('SELECT * FROM personal_entries WHERE id=?', id);
      if (current?.cloud_owner_id && current.cloud_owner_id !== b.userId)
        throw new Error('这份云端记录属于之前的账号，不能转移给新账号');
      const session = await db.getFirstAsync<{ cloud_id: string | null }>(
        'SELECT cloud_id FROM sessions WHERE id=?',
        id,
      );
      const remoteId = current?.cloud_entry_id ?? id;
      const payload = {
        title: name,
        occurredAt: occurred,
        location,
        category,
        notes,
        people: personValues(),
        sessionId: session?.cloud_id ?? null,
      };
      const r = await cloudRequest<PersonalEntry>(
        current?.cloud_entry_id ? `/me/entries/${remoteId}` : '/me/entries',
        current?.cloud_entry_id ? 'PATCH' : 'POST',
        current?.cloud_entry_id
          ? { ...payload, version: current.cloud_version }
          : { ...payload, id: remoteId },
      );
      await db.runAsync(
        'UPDATE personal_entries SET cloud_entry_id=?,cloud_version=?,cloud_owner_id=? WHERE id=?',
        r.id,
        r.version,
        b.userId,
        id,
      );
      setStatus('已保存到本人小程序，只有你可见');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '未完成');
    } finally {
      setBusy(false);
    }
  }
  async function addPhoto(mode: 'camera' | 'library') {
    if (busy || photoLock.current) return;
    photoLock.current = true;
    setBusy(true);
    try {
      await save();
      if (photos.length >= 9) throw new Error('每条记录最多 9 张照片');
      if (mode === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            '需要相机权限才能拍照。请在系统设置中允许使用相机，或从相册导入照片。',
          );
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.8,
        exif: false,
      };
      const picked =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled) return;
      const asset = picked.assets[0]!;
      const scaled = await manipulateAsync(
        asset.uri,
        [
          {
            resize:
              asset.width > asset.height
                ? { width: Math.min(1920, asset.width) }
                : { height: Math.min(1920, asset.height) },
          },
        ],
        { compress: 0.75, format: SaveFormat.JPEG },
      );
      const source = new File(scaled.uri);
      try {
        const dir = new Directory(Paths.document, 'Photos');
        dir.create({ intermediates: true, idempotent: true });
        const photoId = randomUUID();
        const target = new File(dir, `${photoId}.jpg`);
        const db = await getDatabase();
        await persistPhoto({
          source,
          target,
          copy: () => source.copy(target),
          availableBytes: Paths.availableDiskSpace,
          commit: async (uri) => {
            await db.runAsync(
              'INSERT INTO personal_photos(id,session_id,uri) VALUES(?,?,?)',
              photoId,
              id,
              uri,
            );
          },
        });
      } finally {
        // 仅清理本次压缩的缓存副本，不操作选择器提供的相册原图。
        if (source.exists) source.delete();
      }
      setStatus('已保存独立本机副本，删除相册原图后这里仍然保留');
      setPhotos(
        await (
          await getDatabase()
        ).getAllAsync('SELECT * FROM personal_photos WHERE session_id=?', id),
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '未完成');
    } finally {
      photoLock.current = false;
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="记一次活动" subtitle="把今天想记住的，留在手机里" />
      <LocalMediaNotice />
      <Card>
        {[
          [title, setTitle, '活动名称（可选）'],
          [date, setDate, '日期，例如 2026-10-22'],
          [location, setLocation, '地点（可选）'],
          [category, setCategory, '分类（可选）'],
        ].map(([value, set, placeholder]) => (
          <TextInput
            key={String(placeholder)}
            value={value as string}
            placeholder={placeholder as string}
            onChangeText={set as (v: string) => void}
            style={styles.body}
          />
        ))}
        <TextInput
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="今天有什么想记住的？"
          maxLength={20000}
          style={{ ...styles.body, minHeight: 160 }}
        />
        <TextInput
          multiline
          value={people}
          onChangeText={setPeople}
          placeholder="认识的人，每行：名字：备注"
          style={styles.body}
        />
      </Card>
      <Action
        disabled={busy}
        label="保存到本机"
        onPress={() => void save().catch((e) => setStatus(e.message))}
      />
      <Action
        disabled={busy}
        secondary
        label="从相册导入照片"
        onPress={() => void addPhoto('library')}
      />
      <Action
        disabled={busy}
        secondary
        label="拍照记录"
        onPress={() => void addPhoto('camera')}
      />
      {photos.map((p) => (
        <Card key={p.id}>
          <Image
            source={{ uri: p.uri }}
            style={{ width: '100%', height: 220, borderRadius: 16 }}
          />
          <Action
            disabled={busy}
            secondary
            label="删除这张照片"
            onPress={() =>
              Alert.alert(
                '删除照片？',
                '只删除 App 保存的本机副本，不删除系统相册原图。',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        const file = new File(p.uri);
                        if (file.exists) file.delete();
                        await (
                          await getDatabase()
                        ).runAsync(
                          'DELETE FROM personal_photos WHERE id=?',
                          p.id,
                        );
                        setPhotos((old) => old.filter((x) => x.id !== p.id));
                      })().catch((e) => setStatus(e.message));
                    },
                  },
                ],
              )
            }
          />
        </Card>
      ))}
      <Action
        disabled={busy}
        secondary
        label="仅保存文字心得到我的小程序"
        onPress={() =>
          Alert.alert(
            '保存云端私人副本？',
            '仅同步心得和文字认识的人，只有本人可读；照片和录音不会上传。',
            [
              { text: '取消', style: 'cancel' },
              { text: '确认保存', onPress: () => void saveCloud() },
            ],
          )
        }
      />
      <Action
        secondary
        label="录音与 AI"
        onPress={() =>
          void save()
            .then(() =>
              router.push({ pathname: '/session/[id]', params: { id } }),
            )
            .catch((e) => setStatus(e.message))
        }
      />
      <Text style={styles.caption}>{status}</Text>
    </Page>
  );
}

import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
  statSync,
  unlinkSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { migrate, type MigrationDatabase } from './storage/migrations';
import { activeAudioImports } from './activity';
const state = vi.hoisted(() => ({
  root: '',
  path: '',
  name: 'recording.m4a',
  canceled: false,
  duration: 10,
  copyFails: false,
  corrupt: false,
  space: 1e9,
  choose: undefined as undefined | (() => Promise<unknown>),
  seq: 0,
}));
vi.mock('expo-document-picker', () => ({
  getDocumentAsync: async () =>
    state.choose
      ? state.choose()
      : {
          canceled: state.canceled,
          assets: [{ uri: state.path, name: state.name }],
        },
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => 'recording-' + ++state.seq,
}));
vi.mock('react-native', () => ({
  Alert: {
    alert: (
      _title: string,
      _text: string,
      buttons: { onPress: () => void }[],
    ) => buttons[0]!.onPress(),
  },
}));
vi.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    isLoaded: true,
    duration: state.duration,
    remove: () => {},
  }),
}));
vi.mock('expo-file-system', () => {
  class DiskFile {
    uri: string;
    constructor(base: string | { uri: string }, ...parts: string[]) {
      this.uri = join(typeof base === 'string' ? base : base.uri, ...parts);
    }
    get exists() {
      return existsSync(this.uri);
    }
    get size() {
      return statSync(this.uri).size;
    }
    get md5() {
      return createHash('md5').update(readFileSync(this.uri)).digest('hex');
    }
    get name() {
      return basename(this.uri);
    }
    async copy(target: DiskFile) {
      if (state.copyFails) throw new Error('复制失败');
      copyFileSync(this.uri, target.uri);
      if (state.corrupt) writeFileSync(target.uri, 'evil');
    }
    delete() {
      unlinkSync(this.uri);
    }
  }
  class DiskDirectory {
    uri: string;
    constructor(base: { uri: string }, ...parts: string[]) {
      this.uri = join(base.uri, ...parts);
    }
    create() {
      mkdirSync(this.uri, { recursive: true });
    }
  }
  return {
    File: DiskFile,
    Directory: DiskDirectory,
    Paths: {
      get document() {
        return { uri: join(state.root, 'documents') };
      },
      get cache() {
        return { uri: join(state.root, 'cache') + '/' };
      },
      get availableDiskSpace() {
        return state.space;
      },
    },
  };
});
let sqlite: DatabaseSync;
const db: MigrationDatabase & {
  getAllAsync<T>(sql: string, ...args: string[]): Promise<T[]>;
  runAsync(sql: string, ...args: (string | number | null)[]): Promise<unknown>;
} = {
  async execAsync(sql) {
    sqlite.exec(sql);
  },
  async getFirstAsync<T>(sql: string, ...args: string[]) {
    return sqlite.prepare(sql).get(...args) as T;
  },
  async getAllAsync<T>(sql: string, ...args: string[]) {
    return sqlite.prepare(sql).all(...args) as T[];
  },
  async runAsync(sql, ...args) {
    return sqlite.prepare(sql).run(...args);
  },
  async withExclusiveTransactionAsync(fn) {
    sqlite.exec('BEGIN');
    try {
      await fn(db);
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
vi.mock('./storage/database', () => ({ getDatabase: async () => db }));
import { importAudio } from './audio-import';
beforeEach(async () => {
  state.root = mkdtempSync(join(tmpdir(), 'qinggai-audio-'));
  mkdirSync(join(state.root, 'cache'));
  state.path = join(state.root, 'cache', 'source.m4a');
  writeFileSync(state.path, 'good');
  state.name = 'source.m4a';
  state.canceled = false;
  state.duration = 10;
  state.copyFails = false;
  state.corrupt = false;
  state.space = 1e9;
  state.choose = undefined;
  sqlite = new DatabaseSync(':memory:');
  await migrate(db);
  sqlite.exec(
    "INSERT INTO sessions(id,title,state,created_at,updated_at) VALUES('s','记录','ready','now','now')",
  );
});
afterEach(() => {
  sqlite.close();
  rmSync(state.root, { recursive: true, force: true });
  activeAudioImports.clear();
});
it('完成导入后持久副本与原字节一致，清理缓存，索引为 completed', async () => {
  const id = await importAudio('s');
  const row = sqlite
    .prepare('SELECT uri,status,import_state FROM recordings WHERE id=?')
    .get(id!);
  expect(row?.status).toBe('completed');
  expect(row?.import_state).toBe('ready');
  expect(readFileSync(String(row?.uri), 'utf8')).toBe('good');
  expect(existsSync(state.path)).toBe(false);
});
it.each(['不支持格式', '解码失败', '空间不足', '重复取消'] as const)(
  '%s 清理选择器缓存，不留下新录音',
  async (mode) => {
    if (mode === '不支持格式') state.name = 'source.txt';
    if (mode === '解码失败') state.duration = 0;
    if (mode === '空间不足') state.space = 0;
    if (mode === '重复取消')
      sqlite
        .prepare(
          "INSERT INTO recordings(id,session_id,uri,status,created_at,checkpoint_at,fingerprint) VALUES('old','s','old','completed','now','now',?)",
        )
        .run(createHash('md5').update('good').digest('hex'));
    if (mode === '重复取消') await importAudio('s');
    else await expect(importAudio('s')).rejects.toThrow();
    expect(existsSync(state.path)).toBe(false);
    expect(
      sqlite.prepare('SELECT count(*) AS n FROM recordings').get()?.n,
    ).toBe(mode === '重复取消' ? 1 : 0);
    expect(activeAudioImports.size).toBe(0);
  },
);
it.each(['复制失败', '同大小内容损坏'] as const)(
  '%s 不能标为完成，保留失败索引并移除副本',
  async (mode) => {
    state.copyFails = mode === '复制失败';
    state.corrupt = mode === '同大小内容损坏';
    await expect(importAudio('s')).rejects.toThrow();
    const row = sqlite
      .prepare('SELECT uri,status,import_state FROM recordings')
      .get();
    expect(row?.import_state).toBe('failed');
    expect(row?.status).toBe('missing');
    expect(existsSync(String(row?.uri))).toBe(false);
  },
);
it('选择器未关闭时拒绝重复导入，取消后释放锁且不删除非缓存原文件', async () => {
  state.path = join(state.root, 'system-original.m4a');
  writeFileSync(state.path, 'good');
  let resolve!: (value: unknown) => void;
  state.choose = () =>
    new Promise((r) => {
      resolve = r;
    });
  const pending = importAudio('s');
  while (!resolve) await Promise.resolve();
  await expect(importAudio('s')).rejects.toThrow('正在导入');
  resolve({ canceled: true });
  await pending;
  expect(activeAudioImports.size).toBe(0);
  expect(existsSync(state.path)).toBe(true);
  state.choose = undefined;
  await importAudio('s');
  expect(readFileSync(state.path, 'utf8')).toBe('good');
});

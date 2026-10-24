import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
  copyFileSync,
  unlinkSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { it, expect } from 'vitest';
import { persistPhoto, type PhotoFile } from './persist-photo';
class DiskPhoto implements PhotoFile {
  constructor(public uri: string) {}
  get exists() {
    return existsSync(this.uri);
  }
  get size() {
    return statSync(this.uri).size;
  }
  get md5() {
    return createHash('md5').update(readFileSync(this.uri)).digest('hex');
  }
  copy(target: PhotoFile) {
    copyFileSync(this.uri, target.uri);
  }
  delete() {
    unlinkSync(this.uri);
  }
}
it('独立副本在源相册图片删除、索引关闭重开后字节仍完整', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qinggai-photo-'));
  let db = new DatabaseSync(join(dir, 'photos.db'));
  try {
    const source = new DiskPhoto(join(dir, 'album.jpg'));
    const target = new DiskPhoto(join(dir, 'app-copy.jpg'));
    const bytes = Buffer.from('本机照片独立副本测试');
    writeFileSync(source.uri, bytes);
    db.exec('CREATE TABLE photos(uri TEXT)');
    await persistPhoto({
      source,
      target,
      copy: () => source.copy(target),
      availableBytes: 1e8,
      commit: async (uri) => {
        db.prepare('INSERT INTO photos VALUES(?)').run(uri);
      },
    });
    source.delete();
    db.close();
    db = new DatabaseSync(join(dir, 'photos.db'));
    const row = db.prepare('SELECT uri FROM photos').get()!;
    expect(row.uri).toBe(target.uri);
    expect(readFileSync(String(row.uri))).toEqual(bytes);
    target.delete();
    expect(existsSync(source.uri)).toBe(false);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
it.each(['空间不足', '复制损坏', '索引失败', '目标冲突'] as const)(
  '%s 不破坏相册原图，不留下未提交副本',
  async (mode) => {
    const dir = mkdtempSync(join(tmpdir(), 'qinggai-photo-'));
    try {
      const source = new DiskPhoto(join(dir, 'album.jpg'));
      const target = new DiskPhoto(join(dir, 'app-copy.jpg'));
      writeFileSync(source.uri, 'original');
      if (mode === '复制损坏')
        source.copy = () => {
          writeFileSync(target.uri, 'bad-data');
        };
      if (mode === '目标冲突') writeFileSync(target.uri, 'existing');
      await expect(
        persistPhoto({
          source,
          target,
          copy: () => source.copy(target),
          availableBytes: mode === '空间不足' ? 0 : 1e8,
          commit: async () => {
            throw new Error('索引失败');
          },
        }),
      ).rejects.toThrow();
      expect(readFileSync(source.uri, 'utf8')).toBe('original');
      expect(target.exists).toBe(mode === '目标冲突');
      if (mode === '目标冲突')
        expect(readFileSync(target.uri, 'utf8')).toBe('existing');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

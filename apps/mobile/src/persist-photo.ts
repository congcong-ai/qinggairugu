/** 复制到私有持久目录并建立索引；始终不修改系统相册原件。 */
export interface PhotoFile {
  uri: string;
  exists: boolean;
  size: number;
  md5: string | null;
  delete(): void;
}
export async function persistPhoto(input: {
  source: PhotoFile;
  target: PhotoFile;
  availableBytes: number;
  copy: () => void | Promise<void>;
  commit: (uri: string) => Promise<void>;
}) {
  const { source, target, availableBytes, commit } = input;
  if (source.uri === target.uri || target.exists)
    throw new Error('照片目标路径已占用，请重试');
  if (!source.exists || source.size <= 0) throw new Error('照片文件不可用');
  if (source.size > 2 * 1024 * 1024) throw new Error('图片压缩后仍超过 2 MiB');
  if (availableBytes < source.size + 5 * 1024 * 1024)
    throw new Error('手机存储空间不足，请释放空间后重试');
  const size = source.size;
  const digest = source.md5;
  try {
    await input.copy();
    if (
      !target.exists ||
      target.size !== size ||
      !digest ||
      target.md5 !== digest
    )
      throw new Error('照片副本校验失败，请重试');
    await commit(target.uri);
  } catch (error) {
    if (target.exists) target.delete();
    throw error;
  }
}

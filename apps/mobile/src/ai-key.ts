import * as SecureStore from 'expo-secure-store';
import { storageScope } from './account-store';
async function keyName() {
  const scope = await storageScope();
  return scope === 'legacy'
    ? 'qinggairugu.bailianKey'
    : `qinggairugu.bailianKey.${scope}`;
}
export const readAIKey = async () => SecureStore.getItemAsync(await keyName());
export async function saveAIKey(value: string) {
  const key = value.trim();
  if (key.length < 10 || key.length > 512)
    throw new Error('请填写有效的百炼 API Key');
  await SecureStore.setItemAsync(await keyName(), key);
}
export const deleteAIKey = async () =>
  SecureStore.deleteItemAsync(await keyName());

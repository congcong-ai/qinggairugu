import * as SecureStore from 'expo-secure-store';
const keyName = 'pengtou.bailianKey';
export const readAIKey = () => SecureStore.getItemAsync(keyName);
export async function saveAIKey(value: string) {
  const key = value.trim();
  if (key.length < 10 || key.length > 512)
    throw new Error('请填写有效的百炼 API Key');
  await SecureStore.setItemAsync(keyName, key);
}
export const deleteAIKey = () => SecureStore.deleteItemAsync(keyName);

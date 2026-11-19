import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const canShareNativeFiles = () => Capacitor.isNativePlatform();

export async function shareNativeFile(file: File, title = file.name) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the file. Please retry.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
  const filename = file.name.replace(/[^\p{L}\p{N}._-]/gu, '_');
  const result = await Filesystem.writeFile({ path: `shared/${filename}`, data, directory: Directory.Cache, recursive: true });
  await Share.share({ title, files: [result.uri], dialogTitle: 'Save or share file' });
}

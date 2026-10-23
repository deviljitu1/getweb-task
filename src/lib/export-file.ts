import { Capacitor } from '@capacitor/core';

export async function exportFile(blob: Blob, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not prepare the export.'));
      reader.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({ path: `exports/${safeName}`, data: base64, directory: Directory.Cache, recursive: true });
    await Share.share({ title: safeName, files: [file.uri], dialogTitle: 'Save or share export' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = safeName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

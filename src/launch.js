import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';
import { LAUNCH } from './apps.js';

// 回傳訊息字串供畫面顯示;成功開啟時回傳 ''。
export async function openProvider(i) {
  const a = LAUNCH[i];
  if (!Capacitor.isNativePlatform()) return a.name + ': 只有安裝版 App 才能開啟';
  const target = a.androidPackage || a.url;
  if (!target) return a.name + ': 尚未設定套件名稱';
  try {
    const { value } = await AppLauncher.canOpenUrl({ url: target });
    if (value) {
      await AppLauncher.openUrl({ url: target });
      return '';
    }
    if (a.store) await AppLauncher.openUrl({ url: a.store });
    return a.name + ': 尚未安裝,已前往商店';
  } catch (e) {
    return a.name + ': 無法開啟';
  }
}

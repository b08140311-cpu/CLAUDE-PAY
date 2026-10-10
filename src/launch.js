import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';
import { LAUNCH } from './apps.js';
import { launchPackage, launchShortcut } from './appList.js';

// 回傳訊息字串供畫面顯示;成功開啟時回傳 ''。
export async function openProvider(i, custom) {
  const a = LAUNCH[i];
  if (custom && custom.pkg) {
    if (!Capacitor.isNativePlatform()) return custom.label + ': 只有安裝版 App 才能開啟';
    if (custom.shortcut) {
      if (await launchShortcut(custom.pkg, custom.shortcut)) return '';
      // 捷徑開不了(目標頁面可能不對外開放),退回開啟 App 本體
      return (await launchPackage(custom.pkg)) ? custom.label + ': 捷徑無法開啟,已開啟 App' : custom.label + ': 無法開啟';
    }
    return (await launchPackage(custom.pkg)) ? '' : custom.label + ': 無法開啟';
  }
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

import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';
import { LAUNCH } from './apps.js';
import { launchPackage, launchShortcut } from './appList.js';

// 回傳訊息字串供畫面顯示;成功開啟時回傳 ''。
export async function openProvider(i, custom) {
  const a = LAUNCH[i];
  if (!Capacitor.isNativePlatform()) {
    // iOS / 網頁版:只能用 URL Scheme 或「捷徑」開啟
    const url = (custom && custom.url) || a.url || (i === 2 ? 'paypal://' : '');
    if (!url) return a.name + ': 請先在「選擇 App」設定要開啟的捷徑或網址';
    window.location.href = url;
    return '';
  }
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
  try {
    // 1) 先試預設的 deep link(直接開到付款碼等頁面)
    if (a.url) {
      try {
        const r = await AppLauncher.openUrl({ url: a.url });
        if (r && r.completed) return '';
      } catch (e) {}
    }
    // 2) 退回開啟 App 本身
    if (a.androidPackage) {
      const { value } = await AppLauncher.canOpenUrl({ url: a.androidPackage });
      if (value) {
        await AppLauncher.openUrl({ url: a.androidPackage });
        return '';
      }
    }
    // 3) 沒安裝,前往商店
    if (a.store) await AppLauncher.openUrl({ url: a.store });
    return a.name + ': 尚未安裝,已前往商店';
  } catch (e) {
    return a.name + ': 無法開啟';
  }
}

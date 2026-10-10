import { registerPlugin, Capacitor } from '@capacitor/core';

const AppList = registerPlugin('AppList');
const native = () => Capacitor.isNativePlatform();

// 瀏覽器預覽用的假資料(真機會讀手機上實際安裝的 App)
const MOCK = ['相機', '相簿', '地圖', 'LINE', 'PayPal', 'YouTube', '計算機', '設定', 'Chrome', '日曆'].map((n, i) => ({ label: n, package: 'mock.' + i, icon: '' }));

export async function listApps() {
  if (!native()) return MOCK;
  const r = await AppList.list();
  return r.apps || [];
}

export async function launchPackage(pkg) {
  if (!native()) return false;
  try { await AppList.launch({ package: pkg }); return true; } catch (e) { return false; }
}

export async function listShortcuts(pkg) {
  if (!native()) return [{ id: 'scan', label: '掃碼付款' }, { id: 'pay', label: '付款碼' }, { id: 'history', label: '交易紀錄' }];
  try {
    const r = await AppList.shortcuts({ package: pkg });
    return r.shortcuts || [];
  } catch (e) { return []; }
}

export async function launchShortcut(pkg, sc) {
  if (!native()) return false;
  try {
    await AppList.launchShortcut({ package: pkg, action: sc.action, data: sc.data, targetPackage: sc.targetPackage, targetClass: sc.targetClass, noPackage: !!sc.preset });
    return true;
  } catch (e) { return false; }
}

const KEY = 'payhub.targets.v1';
export function loadTargets() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(v) && v.length === 3) return v;
  } catch (e) {}
  return [null, null, null];
}
export function saveTargets(t) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
}

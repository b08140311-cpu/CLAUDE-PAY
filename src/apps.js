// 三個 App 的啟動設定。Android 上用「套件名稱」判斷有沒有安裝(Capacitor AppLauncher)。
// url 是預設要直接開到的頁面(deep link)。
export const LAUNCH = [
  { name: 'LINE Pay', androidPackage: 'jp.naver.line.android', url: 'line://pay/generateQR', store: 'market://details?id=jp.naver.line.android' },
  // PX Pay(全支付)的 Android 套件名稱尚未確認,先靠 deep link 開啟;開不了就去 Play 商店搜尋。
  { name: 'PX Pay', androidPackage: '', url: 'com.pxpay.plus://zjdja', store: 'market://search?q=PX%20Pay' },
  { name: 'PayPal', androidPackage: 'com.paypal.android.p2pmobile', url: '', store: 'market://details?id=com.paypal.android.p2pmobile' }
];

// 內建捷徑:選擇 App 時,在「捷徑」那排一併列出(deep link 來自網路上整理的 iOS/Android 通用 scheme,
// 實機是否可用要自行測試)。match = 套件名稱,slot = 該卡位置(PX Pay 套件名稱未知時用位置判斷)。
export const PRESETS = [
  {
    match: 'jp.naver.line.android',
    items: [
      { id: 'preset_line_code', label: 'LINE Pay 付款碼', data: 'line://pay/generateQR' },
      { id: 'preset_line_scan', label: 'LINE Pay 掃碼', data: 'line://pay/scanQR' }
    ]
  },
  {
    slot: 1,
    items: [
      { id: 'preset_px_code', label: '全支付 付款碼', data: 'com.pxpay.plus://zjdja' },
      { id: 'preset_px_scan', label: '全支付 掃碼', data: 'com.pxpay.plus://nlauluf' }
    ]
  }
];

export function presetsFor(pkg, slot) {
  const out = [];
  PRESETS.forEach((p) => {
    if ((p.match && p.match === pkg) || (p.slot === slot)) {
      p.items.forEach((it) => out.push(Object.assign({ action: 'android.intent.action.VIEW', preset: true }, it)));
    }
  });
  return out;
}

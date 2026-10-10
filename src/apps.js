// 三個 App 的啟動設定。Android 上用「套件名稱」開啟(Capacitor AppLauncher)。
// 改這裡就能換 App;android/AndroidManifest 的 <queries> 要同步(CI 腳本會從這裡讀不到,請同步改 .github/workflows/android.yml)。
export const LAUNCH = [
  { name: 'LINE Pay', androidPackage: 'jp.naver.line.android', url: 'line://', store: 'market://details?id=jp.naver.line.android' },
  // TODO: 確認 PX Pay(全支付)的 Android 套件名稱後填入,例如 'xxx.xxx.xxx'
  { name: 'PX Pay', androidPackage: '', url: '', store: 'market://search?q=PX%20Pay' },
  { name: 'PayPal', androidPackage: 'com.paypal.android.p2pmobile', url: '', store: 'market://details?id=com.paypal.android.p2pmobile' }
];

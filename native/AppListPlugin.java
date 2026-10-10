package com.payhub.app;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.content.res.XmlResourceParser;
import android.net.Uri;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.xmlpull.v1.XmlPullParser;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "AppList")
public class AppListPlugin extends Plugin {

    @PluginMethod
    public void list(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent i = new Intent(Intent.ACTION_MAIN);
            i.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> infos = pm.queryIntentActivities(i, 0);
            final List<JSObject> rows = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            String self = getContext().getPackageName();
            for (ResolveInfo ri : infos) {
                String pkg = ri.activityInfo.packageName;
                if (pkg.equals(self) || !seen.add(pkg)) continue;
                JSObject o = new JSObject();
                o.put("package", pkg);
                o.put("label", String.valueOf(ri.loadLabel(pm)));
                o.put("icon", iconToBase64(ri.loadIcon(pm)));
                rows.add(o);
            }
            Collections.sort(rows, (a, b) -> {
                String x = a.getString("label");
                String y = b.getString("label");
                return x.compareToIgnoreCase(y);
            });
            JSArray arr = new JSArray();
            for (JSObject o : rows) arr.put(o);
            JSObject res = new JSObject();
            res.put("apps", arr);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("list failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void launch(PluginCall call) {
        String pkg = call.getString("package");
        if (pkg == null) { call.reject("missing package"); return; }
        Intent in = getContext().getPackageManager().getLaunchIntentForPackage(pkg);
        if (in == null) { call.reject("not installed"); return; }
        in.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(in);
        call.resolve();
    }

    private static final String NS = "http://schemas.android.com/apk/res/android";

    // 讀取其他 App 的「靜態捷徑」(長按圖示的選單)。動態捷徑(例如 LINE 的聯絡人)只有預設桌面能讀,這裡讀不到。
    @PluginMethod
    public void shortcuts(PluginCall call) {
        String pkg = call.getString("package");
        JSArray out = new JSArray();
        if (pkg == null) { call.reject("missing package"); return; }
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent q = new Intent(Intent.ACTION_MAIN);
            q.addCategory(Intent.CATEGORY_LAUNCHER);
            q.setPackage(pkg);
            Set<String> seen = new HashSet<>();
            for (ResolveInfo ri : pm.queryIntentActivities(q, PackageManager.GET_META_DATA)) {
                ActivityInfo ai = ri.activityInfo;
                int resId = ai.metaData != null ? ai.metaData.getInt("android.app.shortcuts", 0) : 0;
                if (resId == 0) continue;
                Resources res = pm.getResourcesForApplication(ai.applicationInfo);
                XmlResourceParser xp = pm.getXml(pkg, resId, ai.applicationInfo);
                if (xp == null) continue;
                String id = null, label = null, action = null, tp = null, tc = null, data = null;
                boolean inShortcut = false, enabled = true;
                int ev = xp.getEventType();
                while (ev != XmlPullParser.END_DOCUMENT) {
                    if (ev == XmlPullParser.START_TAG) {
                        String tag = xp.getName();
                        if ("shortcut".equals(tag)) {
                            inShortcut = true;
                            id = xp.getAttributeValue(NS, "shortcutId");
                            enabled = xp.getAttributeBooleanValue(NS, "enabled", true);
                            label = resolve(xp, res, "shortcutShortLabel");
                            if (label == null) label = resolve(xp, res, "shortcutLongLabel");
                            action = null; tp = null; tc = null; data = null;
                        } else if ("intent".equals(tag) && inShortcut && action == null && tc == null && data == null) {
                            action = xp.getAttributeValue(NS, "action");
                            tp = xp.getAttributeValue(NS, "targetPackage");
                            tc = xp.getAttributeValue(NS, "targetClass");
                            data = xp.getAttributeValue(NS, "data");
                        }
                    } else if (ev == XmlPullParser.END_TAG && "shortcut".equals(xp.getName())) {
                        if (inShortcut && enabled && label != null && id != null && seen.add(id)) {
                            JSObject o = new JSObject();
                            o.put("id", id);
                            o.put("label", label);
                            o.put("action", action);
                            o.put("targetPackage", tp);
                            o.put("targetClass", tc);
                            o.put("data", data);
                            out.put(o);
                        }
                        inShortcut = false;
                    }
                    ev = xp.next();
                }
            }
        } catch (Exception e) {
            // 讀不到就回傳空清單
        }
        JSObject res = new JSObject();
        res.put("shortcuts", out);
        call.resolve(res);
    }

    private String resolve(XmlResourceParser xp, Resources res, String attr) {
        try {
            int rid = xp.getAttributeResourceValue(NS, attr, 0);
            if (rid != 0) return res.getString(rid);
            return xp.getAttributeValue(NS, attr);
        } catch (Exception e) {
            return null;
        }
    }

    @PluginMethod
    public void launchShortcut(PluginCall call) {
        String pkg = call.getString("package");
        if (pkg == null) { call.reject("missing package"); return; }
        try {
            String action = call.getString("action");
            String data = call.getString("data");
            String tp = call.getString("targetPackage");
            String tc = call.getString("targetClass");
            Intent in = new Intent(action != null ? action : Intent.ACTION_VIEW);
            if (data != null) in.setData(Uri.parse(data));
            if (tc != null) in.setClassName(tp != null ? tp : pkg, tc);
            else if (!call.getBoolean("noPackage", false)) in.setPackage(pkg);
            in.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(in);
            call.resolve();
        } catch (Exception e) {
            call.reject("launch failed: " + e.getMessage());
        }
    }

    private String iconToBase64(Drawable d) {
        try {
            int size = 72;
            Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            d.setBounds(0, 0, size, size);
            d.draw(c);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.PNG, 90, bo);
            return "data:image/png;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }
}

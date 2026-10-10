package com.payhub.app;

import android.content.Intent;
import android.content.pm.PackageManager;
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

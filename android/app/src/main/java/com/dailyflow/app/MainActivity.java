package com.dailyflow.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
                }
                WebSettings settings = webView.getSettings();
                if (settings != null) {
                    settings.setSaveFormData(true);
                    settings.setDomStorageEnabled(true);
                    settings.setDatabaseEnabled(true);
                }
            }
        } catch (Exception ignored) {
            // Safe fallback
        }
    }
}

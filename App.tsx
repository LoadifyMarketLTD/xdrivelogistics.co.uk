import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { WebView } from "react-native-webview";
import { config } from "./src/config";

const INJECT_VIEWPORT_SCRIPT = `
(function() {
  try {
    var content = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
    var existing = document.querySelector('meta[name="viewport"]');
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      var meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('content', content);
      document.head && document.head.appendChild(meta);
    }
    document.documentElement.style.width = '100%';
    document.body.style.width = '100%';
    document.body.style.overflowX = 'hidden';
  } catch (e) {}
})();
true;
`;

function buildDriverUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/$/, "");
  const safeBase = normalized || "http://127.0.0.1:3005";
  return `${safeBase}/login?appShell=1&next=%2Fm%2Fdriver%2Factive`;
}

export default function App() {
  const [hasError, setHasError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeUrl = useMemo(() => buildDriverUrl(config.xdriveBaseUrl), []);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => null);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />

      {hasError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Unable to load driver app</Text>
          <Text style={styles.errorText}>{hasError}</Text>
          <Text style={styles.errorHint}>Open this URL in browser: {activeUrl}</Text>
        </View>
      ) : null}

      <WebView
        source={{ uri: activeUrl }}
        userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
        injectedJavaScriptBeforeContentLoaded={INJECT_VIEWPORT_SCRIPT}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        incognito
        startInLoadingState
        scalesPageToFit={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        pullToRefreshEnabled={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures={false}
        onLoadStart={() => {
          setIsLoading(true);
          setHasError(null);
        }}
        onLoadEnd={() => {
          setIsLoading(false);
        }}
        onError={(event) => {
          setHasError(event.nativeEvent.description || "Unknown loading error");
          setIsLoading(false);
        }}
        onHttpError={(event) => {
          setHasError(`HTTP ${event.nativeEvent.statusCode} at ${event.nativeEvent.url}`);
          setIsLoading(false);
        }}
        renderLoading={() => (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#0a4fb4" />
            <Text style={styles.loaderText}>Loading XDrive Driver PWA...</Text>
          </View>
        )}
      />

      {isLoading ? (
        <View pointerEvents="none" style={styles.loaderOverlay}>
          <ActivityIndicator size="small" color="#0a4fb4" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#f6f8fb",
  },
  loaderText: {
    color: "#1f2937",
    fontSize: 14,
  },
  loaderOverlay: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  errorWrap: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    zIndex: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7f1d1d",
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: "#7f1d1d",
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 12,
    color: "#991b1b",
  },
});

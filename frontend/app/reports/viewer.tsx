import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AppDialog from '@/components/AppDialog';
import SuccessPopup from '@/components/SuccessPopup';
import { colors } from '@/constants/colors';
import { authService } from '@/services/auth';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { buildAuthorizedReportFileUrl, resolveReportFileUrl } from '@/utils/reportFileUrl';

/**
 * Expo Go does not include react-native-pdf native code. The JS module still loads and renders
 * a blank surface without firing onError — force canvas/WebView fallbacks instead.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let PdfView: React.ComponentType<{
  source: { uri: string; cache?: boolean };
  style?: object;
  trustAllCerts?: boolean;
  fitPolicy?: 0 | 1 | 2;
  onLoadComplete?: (pages: number) => void;
  onError?: (err: object) => void;
}> | null = null;

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    PdfView = require('react-native-pdf').default;
  } catch {
    PdfView = null;
  }
}

function iosContainingDirectoryUri(fileUri: string): string {
  const i = fileUri.lastIndexOf('/');
  return i >= 0 ? fileUri.slice(0, i + 1) : fileUri;
}

function ReportViewerHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="bg-coral px-4 pb-3 pt-2">
      <View className="flex-row items-center rounded-2xl bg-white px-1 py-1.5 shadow-sm shadow-black/5">
        <TouchableOpacity
          onPress={onBack}
          className="h-11 w-11 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
            size={Platform.OS === 'ios' ? 26 : 22}
            color={colors.text.primary}
          />
        </TouchableOpacity>
        <Text
          className="flex-1 text-center text-base font-bold text-text"
          numberOfLines={1}
        >
          {title}
        </Text>
        <View className="h-11 w-11" />
      </View>
    </View>
  );
}

function pickParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  return btoa(binary);
}

/** Max PDF size for the PDF.js WebView fallback (loads full file as base64 in memory). */
const MAX_PDF_JS_FALLBACK_BYTES = 200 * 1024 * 1024;

async function downloadWithAuth(sourcePath: string, destinationPath: string) {
  const token = await authService.getAccessToken();
  const resolved = resolveReportFileUrl(sourcePath);
  const result = await FileSystem.downloadAsync(resolved, destinationPath, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if ((result as any).status && (result as any).status >= 400) {
    throw new Error(`Download failed with status ${(result as any).status}`);
  }
  return result;
}

function buildPdfJsHtml(base64: string): string {
  const b64Literal = JSON.stringify(base64);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes" />
<style>
  body { margin: 0; background: #525659; padding: 8px 0 24px; }
  canvas { display: block; margin: 0 auto 12px; max-width: 100%; height: auto; }
  #err { color: #fff; font-family: system-ui; padding: 16px; }
</style>
</head>
<body>
<div id="err"></div>
<script>
(function () {
  var B64 = ${b64Literal};
  var WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
  var CDN1 = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
  var CDN2 = 'https://unpkg.com/pdfjs-dist@2.16.105/build/pdf.min.js';

  function fail(msg) {
    var el = document.getElementById('err');
    if (el) el.textContent = msg;
  }

  function loadScript(src, onload, onerror) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = onload;
    s.onerror = onerror;
    document.head.appendChild(s);
  }

  function renderPdf() {
    try {
      var pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib || !pdfjsLib.getDocument) {
        fail('PDF library failed to load.');
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
      var binary = atob(B64);
      var len = binary.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
        var body = document.body;
        var errEl = document.getElementById('err');
        if (errEl) errEl.remove();
        function renderPage(num) {
          return pdf.getPage(num).then(function (page) {
            var base = page.getViewport({ scale: 1 });
            var scale = Math.min((window.innerWidth - 16) / base.width, 2.5);
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            body.appendChild(canvas);
            return page.render({ canvasContext: ctx, viewport: viewport }).promise;
          });
        }
        var chain = Promise.resolve();
        for (var p = 1; p <= pdf.numPages; p++) {
          (function (pageNum) {
            chain = chain.then(function () { return renderPage(pageNum); });
          })(p);
        }
      }).catch(function (e) {
        fail(e && e.message ? e.message : 'PDF render error');
      });
    } catch (e) {
      fail(e && e.message ? e.message : 'PDF error');
    }
  }

  loadScript(CDN1, renderPdf, function () {
    loadScript(CDN2, renderPdf, function () {
      fail('Could not load PDF preview library. Check your network.');
    });
  });
})();
</script>
</body>
</html>`;
}

export default function ReportDocumentViewerScreen() {
  const router = useRouter();
  const { dialog, hideDialog, showDialog } = useAppDialog();
  const params = useLocalSearchParams<{
    path?: string;
    title?: string;
    mime?: string;
    reportId?: string;
    kind?: string;
  }>();

  const [imageUri, setImageUri] = useState<string | null>(null);
  /** Local file:// after download, or remote https URL for Web (and Pdf remote fallback) */
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  /** Canvas-based PDF.js fallback (Expo Go / when native Pdf fails) */
  const [pdfHtmlFallback, setPdfHtmlFallback] = useState<string | null>(null);
  /** Unmount react-native-pdf after onError so we do not stay on a blank surface */
  const [nativePdfFailed, setNativePdfFailed] = useState(false);
  /** iOS Expo Go: try WKWebView with file:// first; on failure use PDF.js */
  const [iosFileWebViewFailed, setIosFileWebViewFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccessVisible, setDownloadSuccessVisible] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const cachedFileRef = useRef<string | null>(null);

  const rawPath = pickParam(params.path) ? decodeURIComponent(pickParam(params.path)!) : '';
  const decodedTitle = pickParam(params.title)
    ? decodeURIComponent(pickParam(params.title)!)
    : 'Document';
  const mime = pickParam(params.mime) ?? '';
  const isImage = mime.startsWith('image/');

  useEffect(() => {
    return () => {
      if (cachedFileRef.current) {
        FileSystem.deleteAsync(cachedFileRef.current, { idempotent: true }).catch(() => undefined);
        cachedFileRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!rawPath) {
        setLoadError('Missing document path.');
        setLoading(false);
        return;
      }

      setLoadError(null);
      setImageUri(null);
      setPdfUri(null);
      setPdfHtmlFallback(null);
      setNativePdfFailed(false);
      setIosFileWebViewFailed(false);

      if (cachedFileRef.current) {
        FileSystem.deleteAsync(cachedFileRef.current, { idempotent: true }).catch(() => undefined);
        cachedFileRef.current = null;
      }

      try {
        setLoading(true);
        const authorized = await buildAuthorizedReportFileUrl(rawPath);

        if (isImage) {
          if (!cancelled) setImageUri(authorized);
          return;
        }

        if (Platform.OS === 'web') {
          if (!cancelled) setPdfUri(authorized);
          return;
        }

        if (!FileSystem.cacheDirectory) {
          if (!cancelled) setPdfUri(authorized);
          return;
        }

        const ext = mime.includes('png')
          ? '.png'
          : mime.includes('jpeg') || mime.includes('jpg')
            ? '.jpg'
            : '.pdf';
        const dest = `${FileSystem.cacheDirectory}report-${Date.now()}${ext}`;
        const { uri } = await downloadWithAuth(rawPath, dest);
        cachedFileRef.current = uri;
        if (!cancelled) setPdfUri(uri);
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e?.message ?? 'Unable to load document');
          try {
            const fallback = await buildAuthorizedReportFileUrl(rawPath);
            if (!cancelled) setPdfUri(fallback);
          } catch {
            /* keep error */
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawPath, mime, isImage, reloadKey]);

  /** Expo Go / no native Pdf: render PDF via PDF.js + canvas inside WebView. */
  useEffect(() => {
    if (Platform.OS === 'web' || isImage || !pdfUri || PdfView) return;
    if (
      isExpoGo &&
      Platform.OS === 'ios' &&
      pdfUri.startsWith('file') &&
      !iosFileWebViewFailed
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let b64: string;
        if (pdfUri.startsWith('file')) {
          const info = await FileSystem.getInfoAsync(pdfUri);
          if (
            info.exists &&
            'size' in info &&
            info.size > MAX_PDF_JS_FALLBACK_BYTES
          ) {
            if (!cancelled) {
              setLoadError(
                'This PDF is over 200 MB and cannot be previewed in-app. Open Details or use a development build.',
              );
            }
            return;
          }
          b64 = await FileSystem.readAsStringAsync(pdfUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          const res = await fetch(pdfUri);
          if (!res.ok) throw new Error('Download failed');
          const buf = await res.arrayBuffer();
          if (buf.byteLength > MAX_PDF_JS_FALLBACK_BYTES) {
            if (!cancelled) {
              setLoadError(
                'This PDF is over 200 MB and cannot be previewed in-app. Open Details or use a dev build.',
              );
            }
            return;
          }
          b64 = arrayBufferToBase64(buf);
        }
        if (!cancelled) setPdfHtmlFallback(buildPdfJsHtml(b64));
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? 'Could not read PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUri, isImage, iosFileWebViewFailed]);

  const retry = () => {
    setReloadKey((k) => k + 1);
  };

  const downloadCurrentPdf = async () => {
    if (isImage || !rawPath || downloading) return;

    try {
      setDownloading(true);
      const docDir = FileSystem.documentDirectory;
      if (!docDir) {
        showDialog('Download unavailable', 'Could not access local storage.');
        return;
      }

      const safeName = (decodedTitle || 'report')
        .replace(/[^\w\d-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const targetPath = `${docDir}${safeName || 'report'}-${Date.now()}.pdf`;

      if (pdfUri && pdfUri.startsWith('file://')) {
        await FileSystem.copyAsync({ from: pdfUri, to: targetPath });
      } else {
        await downloadWithAuth(rawPath, targetPath);
      }

      setDownloadSuccessVisible(true);
    } catch (e: any) {
      showDialog(
        'Download failed',
        e?.message ?? 'Unable to download this PDF right now.',
      );
    } finally {
      setDownloading(false);
    }
  };

  const loadPdfJsFallbackFromUri = async () => {
    if (!pdfUri) return;
    try {
      let b64: string;
      if (pdfUri.startsWith('file')) {
        const info = await FileSystem.getInfoAsync(pdfUri);
        if (
          info.exists &&
          'size' in info &&
          info.size > MAX_PDF_JS_FALLBACK_BYTES
        ) {
          setLoadError('PDF is over 200 MB and cannot be previewed in this viewer.');
          return;
        }
        b64 = await FileSystem.readAsStringAsync(pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        const res = await fetch(pdfUri);
        if (!res.ok) throw new Error('Download failed');
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_PDF_JS_FALLBACK_BYTES) {
          setLoadError('PDF is over 200 MB and cannot be previewed in this viewer.');
          return;
        }
        b64 = arrayBufferToBase64(buf);
      }
      setPdfHtmlFallback(buildPdfJsHtml(b64));
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not load PDF preview');
    }
  };

  const renderPdfBody = () => {
    if (!pdfUri) return null;

    if (pdfHtmlFallback) {
      return (
        <WebView
          originWhitelist={['*']}
          source={{ html: pdfHtmlFallback, baseUrl: 'https://cdnjs.cloudflare.com/' }}
          style={{ flex: 1, backgroundColor: colors.background.secondary }}
          allowFileAccess
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          cacheEnabled
          thirdPartyCookiesEnabled
          setBuiltInZoomControls={false}
          onError={() => {
            setLoadError('PDF preview failed to load in the WebView.');
          }}
          onHttpError={() => {
            setLoadError('Could not load PDF preview resources. Check your network connection.');
          }}
        />
      );
    }

    if (Platform.OS === 'web') {
      return (
        <WebView
          source={{ uri: pdfUri }}
          style={{ flex: 1, backgroundColor: colors.background.secondary }}
          originWhitelist={['*']}
          allowFileAccess
          setSupportMultipleWindows={false}
        />
      );
    }

    if (
      isExpoGo &&
      Platform.OS === 'ios' &&
      pdfUri.startsWith('file') &&
      !iosFileWebViewFailed
    ) {
      return (
        <WebView
          originWhitelist={['*']}
          source={{ uri: pdfUri }}
          style={{ flex: 1, backgroundColor: colors.background.secondary }}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={iosContainingDirectoryUri(pdfUri)}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          onError={() => setIosFileWebViewFailed(true)}
          onHttpError={() => setIosFileWebViewFailed(true)}
        />
      );
    }

    if (PdfView && !nativePdfFailed) {
      return (
        <PdfView
          source={{ uri: pdfUri, cache: false }}
          trustAllCerts
          fitPolicy={0}
          style={{ flex: 1, width: '100%', backgroundColor: colors.background.secondary }}
          onLoadComplete={() => setLoadError(null)}
          onError={(err) => {
            console.warn('[ReportViewer] Pdf error', err);
            setNativePdfFailed(true);
            void loadPdfJsFallbackFromUri();
          }}
        />
      );
    }

    if (loadError) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-error">{loadError}</Text>
          <TouchableOpacity className="mt-4" onPress={retry}>
            <Text className="text-sm font-semibold text-coral-deep">Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color={colors.coral.deep} />
        <Text className="mt-3 text-center text-sm text-text-secondary">Preparing PDF preview…</Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={hideDialog}
      />
      <SuccessPopup
        visible={downloadSuccessVisible}
        message="Saved to your device. You can find it in this app’s documents folder."
        onClose={() => setDownloadSuccessVisible(false)}
      />
      <ReportViewerHeader title={decodedTitle} onBack={() => router.back()} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.coral.deep} />
          <Text className="mt-3 text-sm text-text-secondary">Opening document…</Text>
        </View>
      ) : loadError && !pdfUri && !imageUri ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-error">{loadError}</Text>
          <TouchableOpacity className="mt-3" onPress={retry}>
            <Text className="text-sm font-semibold text-coral-deep">Try again</Text>
          </TouchableOpacity>
        </View>
      ) : imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ flex: 1, width: '100%' }}
          resizeMode="contain"
          onError={() => setLoadError('Could not display this image.')}
        />
      ) : pdfUri ? (
        <View className="flex-1">{renderPdfBody()}</View>
      ) : null}

      {!loading && !isImage && pdfUri ? (
        <TouchableOpacity
          onPress={downloadCurrentPdf}
          disabled={downloading}
          className={`absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-coral-deep shadow-lg ${
            downloading ? 'opacity-70' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel="Download opened PDF"
        >
          {downloading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

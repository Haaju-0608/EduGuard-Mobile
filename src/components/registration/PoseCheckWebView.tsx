import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Kiểm tra góc quay đầu của 1 ẢNH TĨNH đã chụp (không phải video liên tục như FaceScanWebView bên
// điểm danh) — cùng kỹ thuật WebView + MediaPipe (WASM chỉ chạy được trong trình duyệt thật, không
// chạy trong Hermes) để không cần build lại app. Chỉ dùng landmark, KHÔNG decode transformation
// matrix (phức tạp, dễ sai) — so khoảng cách từ mũi tới 2 mép mặt (landmark 234/454 của MediaPipe
// FaceLandmarker) để suy ra ảnh có đối xứng (nhìn thẳng) hay lệch hẳn 1 bên (đã quay đầu) — đủ để
// phát hiện "3 ảnh đều chụp thẳng mặt" (lỗi hay gặp nhất) mà không cần biết chính xác trái/phải thật
// ngoài đời (tránh rủi ro sai do ảnh có bị lật gương hay không tuỳ máy/nền tảng).
const POSE_CHECK_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;background:#000;">
<script type="module">
  import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';

  var landmarker = null;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function init() {
    FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm')
      .then(function (vision) {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
        });
      })
      .then(function (lm) {
        landmarker = lm;
        post({ type: 'ready' });
      })
      .catch(function () {
        post({ type: 'ready', failed: true });
      });
  }

  function analyze(requestId, dataUrl) {
    if (!landmarker) { post({ type: 'result', requestId: requestId, ok: false, reason: 'not-ready' }); return; }
    var img = new Image();
    img.onload = function () {
      try {
        var result = landmarker.detect(img);
        var lm = result && result.faceLandmarks && result.faceLandmarks[0];
        if (!lm) { post({ type: 'result', requestId: requestId, ok: false, reason: 'no-face' }); return; }
        var nose = lm[1], leftEdge = lm[234], rightEdge = lm[454];
        var dLeft = Math.abs(nose.x - leftEdge.x);
        var dRight = Math.abs(nose.x - rightEdge.x);
        var ratio = dRight > 0.0001 ? dLeft / dRight : 999;
        post({ type: 'result', requestId: requestId, ok: true, ratio: ratio });
      } catch (e) {
        post({ type: 'result', requestId: requestId, ok: false, reason: 'error' });
      }
    };
    img.onerror = function () {
      post({ type: 'result', requestId: requestId, ok: false, reason: 'image-load-failed' });
    };
    img.src = dataUrl;
  }

  function handle(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (msg.type === 'analyze') analyze(msg.requestId, msg.dataUrl);
  }

  document.addEventListener('message', function (e) { handle(e.data); });
  window.addEventListener('message', function (e) { handle(e.data); });

  init();
</script>
</body>
</html>`;

export type PoseCheckResult =
  | { ok: true; ratio: number }
  | { ok: false; reason: 'not-ready' | 'no-face' | 'error' | 'image-load-failed' | 'timeout' };

export interface PoseCheckWebViewHandle {
  /** base64 JPEG (không kèm tiền tố data:) của ảnh vừa chụp — trả về Promise, không bao giờ reject,
   *  lỗi/timeout đều trả { ok: false }, để nơi gọi tự quyết định fail-open (cho qua) khi không chắc. */
  analyze: (base64Jpeg: string) => Promise<PoseCheckResult>;
}

const ANALYZE_TIMEOUT_MS = 8_000;

const PoseCheckWebView = forwardRef<PoseCheckWebViewHandle>((_props, ref) => {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<Map<string, (result: PoseCheckResult) => void>>(new Map());

  useImperativeHandle(ref, () => ({
    analyze: (base64Jpeg: string) =>
      new Promise<PoseCheckResult>((resolve) => {
        if (!readyRef.current) { resolve({ ok: false, reason: 'not-ready' }); return; }
        const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          resolve({ ok: false, reason: 'timeout' });
        }, ANALYZE_TIMEOUT_MS);
        pendingRef.current.set(requestId, (result) => { clearTimeout(timer); resolve(result); });
        webviewRef.current?.postMessage(JSON.stringify({
          type: 'analyze', requestId, dataUrl: `data:image/jpeg;base64,${base64Jpeg}`,
        }));
      }),
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (msg.type === 'ready') {
      readyRef.current = !msg.failed;
    } else if (msg.type === 'result' && msg.requestId) {
      const resolve = pendingRef.current.get(msg.requestId);
      if (!resolve) return;
      pendingRef.current.delete(msg.requestId);
      if (msg.ok) resolve({ ok: true, ratio: msg.ratio });
      else resolve({ ok: false, reason: msg.reason ?? 'error' });
    }
  };

  // Ẩn khỏi màn hình nhưng vẫn giữ kích thước thật (khác 0) — WebView 0x0/display:none dễ bị hệ
  // điều hành coi là "không hiển thị" và tạm dừng JS bên trong, làm mất kết quả phân tích.
  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webviewRef}
        style={styles.webview}
        source={{ html: POSE_CHECK_HTML, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
});

PoseCheckWebView.displayName = 'PoseCheckWebView';
export default PoseCheckWebView;

const styles = StyleSheet.create({
  hiddenContainer: { position: 'absolute', top: -1000, left: 0, width: 4, height: 4, opacity: 0 },
  webview: { width: 4, height: 4 },
});

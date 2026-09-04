import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// Chạy trong 1 WebView (không phải native code) vì MediaPipe Tasks Vision (dùng để phát hiện "có
// mặt ổn định trong khung hình" — quyết định LÚC NÀO tự động chụp, không so khớp danh tính gì cả)
// là thư viện WASM chỉ chạy được trong môi trường trình duyệt thật, Hermes (JS engine của RN) không
// chạy WASM theo cách này. Trang HTML load MediaPipe qua CDN (jsdelivr + storage.googleapis.com) nên
// cần mạng, không cần build lại app bằng EAS / rời Expo Go. Việc so khớp danh tính THẬT vẫn 100% do
// BE quyết định (markAttendanceByAiPhoto → POST .../records/ai-photo) — trang này chỉ báo "chụp đi".
const FACE_SCAN_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>
  html, body { margin:0; padding:0; background:#000; overflow:hidden; height:100%; width:100%; }
  #video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#000; }
  #frame { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  #face-guide { width:92vw; max-width:440px; height:auto; }
  #face-guide .oval { stroke:rgba(255,255,255,0.25); transition:stroke 0.15s, filter 0.15s; }
  #face-guide .corners { stroke:#10B981; }
  #face-guide.stable .oval { stroke:#10B981; filter:drop-shadow(0 0 8px rgba(16,185,129,0.45)); }
  #status {
    position:absolute; left:0; right:0; bottom:26px; text-align:center; color:#fff;
    font-family:-apple-system,Roboto,sans-serif; font-size:13px; font-weight:600;
    text-shadow:0 1px 3px rgba(0,0,0,0.6); padding:0 24px;
  }
  #err {
    position:absolute; inset:0; display:none; align-items:center; justify-content:center;
    flex-direction:column; gap:10px; background:#0A0F2E; color:#F1F5FF;
    font-family:-apple-system,Roboto,sans-serif; font-size:14px; text-align:center; padding:32px;
  }
</style>
</head>
<body>
  <video id="video" autoplay playsinline muted></video>
  <div id="frame">
    <svg id="face-guide" viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg">
      <ellipse class="oval" cx="120" cy="150" rx="96" ry="128" fill="none" stroke-width="2.5"/>
      <g class="corners" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M30 52 L30 18 L64 18"/>
        <path d="M176 18 L210 18 L210 52"/>
        <path d="M30 248 L30 282 L64 282"/>
        <path d="M176 282 L210 282 L210 248"/>
      </g>
    </svg>
  </div>
  <div id="status">Starting camera…</div>
  <div id="err"></div>
  <canvas id="canvas" style="display:none"></canvas>
  <script type="module">
    import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';

    var video     = document.getElementById('video');
    var faceGuide = document.getElementById('face-guide');
    var status    = document.getElementById('status');
    var errEl     = document.getElementById('err');
    var canvas    = document.getElementById('canvas');

    var STABLE_MS = 900;

    var landmarker = null;
    var facing = 'environment';
    var stableSince = null;
    var paused = false;
    var manualPause = false;

    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }

    function showError(message) {
      status.style.display = 'none';
      errEl.style.display = 'flex';
      errEl.textContent = message;
      post({ type: 'error', message: message });
    }

    function startStream() {
      return navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      }).then(function (stream) {
        video.srcObject = stream;
        return video.play();
      }).catch(function () {
        showError('Camera access denied. Please allow camera permission and retry.');
      });
    }

    function init() {
      startStream().then(function () {
        return FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
      }).then(function (vision) {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });
      }).then(function (lm) {
        landmarker = lm;
        status.textContent = "Point the camera at a student's face";
        post({ type: 'ready' });
        requestAnimationFrame(loop);
      }).catch(function () {
        showError('Could not load the face scanner. Check your connection and retry.');
      });
    }

    function loop() {
      requestAnimationFrame(loop);
      if (!landmarker || paused || manualPause) return;
      if (video.readyState < 2 || !video.videoWidth) return;

      var result = landmarker.detectForVideo(video, performance.now());
      var hasFace = !!(result && result.faceLandmarks && result.faceLandmarks[0]);

      if (hasFace) {
        if (stableSince == null) stableSince = performance.now();
        faceGuide.classList.add('stable');
        if (performance.now() - stableSince >= STABLE_MS) capture();
      } else {
        stableSince = null;
        faceGuide.classList.remove('stable');
      }
    }

    function capture() {
      paused = true;
      stableSince = null;
      faceGuide.classList.remove('stable');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      post({ type: 'capture', dataUrl: dataUrl });
    }

    function stopTracks() {
      var old = video.srcObject;
      if (old) old.getTracks().forEach(function (t) { t.stop(); });
    }

    function handleNative(raw) {
      var msg;
      try { msg = JSON.parse(raw); } catch (e) { msg = { type: raw }; }
      if (msg.type === 'resume') {
        setTimeout(function () { paused = false; }, msg.cooldownMs || 1500);
      } else if (msg.type === 'pause') {
        manualPause = true;
        status.textContent = 'Scanning paused';
      } else if (msg.type === 'unpause') {
        manualPause = false;
        status.textContent = "Point the camera at a student's face";
      } else if (msg.type === 'flip') {
        facing = facing === 'environment' ? 'user' : 'environment';
        stopTracks();
        startStream();
      }
    }

    document.addEventListener('message', function (e) { handleNative(e.data); });
    window.addEventListener('message', function (e) { handleNative(e.data); });

    init();
  </script>
</body>
</html>`;

export interface FaceScanWebViewHandle {
  resume: (cooldownMs?: number) => void;
  pause: () => void;
  unpause: () => void;
  flip: () => void;
}

interface FaceScanWebViewProps {
  onCapture: (dataUrl: string) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

const FaceScanWebView = forwardRef<FaceScanWebViewHandle, FaceScanWebViewProps>(
  ({ onCapture, onReady, onError }, ref) => {
    const webviewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      resume: (cooldownMs) => webviewRef.current?.postMessage(JSON.stringify({ type: 'resume', cooldownMs })),
      pause: () => webviewRef.current?.postMessage(JSON.stringify({ type: 'pause' })),
      unpause: () => webviewRef.current?.postMessage(JSON.stringify({ type: 'unpause' })),
      flip: () => webviewRef.current?.postMessage(JSON.stringify({ type: 'flip' })),
    }));

    const handleMessage = (event: WebViewMessageEvent) => {
      let msg: any;
      try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
      if (msg.type === 'capture' && typeof msg.dataUrl === 'string') {
        onCapture(msg.dataUrl);
      } else if (msg.type === 'ready') {
        onReady?.();
      } else if (msg.type === 'error') {
        onError?.(msg.message ?? 'Camera error.');
      }
    };

    return (
      <WebView
        ref={webviewRef}
        style={styles.webview}
        source={{ html: FACE_SCAN_HTML, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        androidLayerType="hardware"
      />
    );
  },
);

FaceScanWebView.displayName = 'FaceScanWebView';
export default FaceScanWebView;

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
});

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5QrcodeScanType } from 'html5-qrcode';
import { X, Camera, AlertTriangle, RefreshCw } from 'lucide-react';

const SCANNER_ELEMENT_ID = 'barcode-scanner-viewport';
const HEADER_MESSAGE_ID = `${SCANNER_ELEMENT_ID}__header_message`;
const MAX_AUTO_RETRIES = 2;
const STORAGE_KEY = 'HTML5_QRCODE_DATA';
const FRONT_LABEL_RE = /front|user|frontal|delantera/i;
const BACK_LABEL_RE = /back|rear|trasera|environment/i;

// La librería recuerda la última cámara usada en localStorage (clave global,
// no depende del sitio) y, si no hay ninguna guardada, arranca con la que
// figure primera en la lista del sistema — que en varios celulares es la
// delantera. Antes de montar el selector, forzamos que la cámara "recordada"
// sea una trasera (por etiqueta, o la última de la lista si no hay etiquetas
// claras), salvo que el usuario ya haya elegido una trasera a propósito antes.
const ensureBackCameraPreferred = async () => {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || cameras.length < 2) return;

    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { /* ignorar */ }
    const storedCam = stored?.lastUsedCameraId ? cameras.find(c => c.id === stored.lastUsedCameraId) : null;
    if (storedCam && !FRONT_LABEL_RE.test(storedCam.label || '')) return; // ya hay una trasera elegida, no tocar

    let backId = cameras.find(c => BACK_LABEL_RE.test(c.label || ''))?.id;

    if (!backId) {
      // Etiquetas ambiguas (algunos navegadores no describen la lente): le pedimos
      // directamente al navegador la cámara "environment" y vemos qué deviceId eligió.
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        backId = probe.getVideoTracks()[0]?.getSettings().deviceId;
        probe.getTracks().forEach(t => t.stop());
      } catch (_) { /* seguimos con el fallback de abajo */ }
    }

    if (!backId) {
      backId = (cameras.find(c => !FRONT_LABEL_RE.test(c.label || '')) || cameras[cameras.length - 1])?.id;
    }

    if (backId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hasPermission: true, lastUsedCameraId: backId }));
    }
  } catch (_) {
    // Si el sondeo falla (permiso denegado, etc.), dejamos que el flujo normal de la librería lo maneje.
  }
};

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
];

// Modal de escaneo de código de barras usando la cámara del dispositivo.
// Usa la UI completa de html5-qrcode (no la versión "minimal" con Html5Qrcode a secas)
// porque en celulares con más de una cámara trasera (angular normal + ultra gran angular,
// que suele tener foco fijo y no enfoca de cerca) el navegador puede elegir la lente
// equivocada. Esta UI agrega selector de cámara, zoom y linterna, y recuerda la
// cámara elegida la próxima vez (rememberLastUsedCamera).
const BarcodeScannerModal = ({ onScan, onClose }) => {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [hardwareError, setHardwareError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const autoRetriesRef = useRef(0);

  useEffect(() => {
    if (window.isSecureContext === false) {
      setError('La cámara requiere una conexión segura (HTTPS). Abrí la app desde el enlace https:// que te compartieron.');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Este navegador no soporta acceso a la cámara.');
      return;
    }

    let cancelled = false;
    let scanner = null;
    let observer = null;

    const init = async () => {
      await ensureBackCameraPreferred();
      if (cancelled) return;

      scanner = new Html5QrcodeScanner(
        SCANNER_ELEMENT_ID,
        {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.4,
          formatsToSupport: FORMATS,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2,
        },
        false
      );
      scannerRef.current = scanner;
      let handled = false;

      scanner.render(
        (decodedText) => {
          if (handled) return;
          handled = true;
          if (navigator.vibrate) navigator.vibrate(80);
          scanner.clear().catch(() => {}).finally(() => onScan(decodedText));
        },
        () => {} // callback de "no se detectó nada en este frame": se ignora
      );

      // La librería no expone un callback para errores de hardware (ej. NotReadableError
      // cuando la cámara quedó ocupada por un intento anterior); los muestra escribiendo
      // texto en su propio banner de estado. Lo observamos para poder ofrecer un reintento.
      observer = new MutationObserver(() => {
        const el = document.getElementById(HEADER_MESSAGE_ID);
        if (!el || el.style.display === 'none') return;
        const text = el.textContent || '';
        if (/NotReadable|Could not start video|TrackStart|AbortError/i.test(text)) {
          setHardwareError(text);
        }
      });
      const root = document.getElementById(SCANNER_ELEMENT_ID);
      if (root) observer.observe(root, { childList: true, subtree: true, characterData: true });
    };
    init();

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [retryToken]);

  useEffect(() => {
    if (!hardwareError) return;
    if (autoRetriesRef.current >= MAX_AUTO_RETRIES) return;
    autoRetriesRef.current += 1;
    // Espera breve para que el dispositivo libere la cámara antes de reintentar.
    const t = setTimeout(() => {
      setHardwareError(null);
      setRetryToken((v) => v + 1);
    }, 900);
    return () => clearTimeout(t);
  }, [hardwareError]);

  const handleManualRetry = () => {
    autoRetriesRef.current = 0;
    setHardwareError(null);
    setRetryToken((v) => v + 1);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90">
      <div className="glass-panel rounded-2xl w-full max-w-sm shadow-lg border border-slate-700/50 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 shrink-0">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <Camera size={18} className="text-indigo-400" /> Escanear código
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center text-center gap-3 py-6 text-slate-300">
              <AlertTriangle className="text-amber-400" size={36} />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              {hardwareError && (
                <div className="flex flex-col items-center text-center gap-3 py-4 mb-3 text-slate-300 bg-slate-900/60 rounded-xl border border-amber-500/30">
                  <AlertTriangle className="text-amber-400" size={30} />
                  <p className="text-sm px-3">
                    No se pudo iniciar la cámara (puede estar ocupada por otra app o pestaña).
                    {autoRetriesRef.current < MAX_AUTO_RETRIES ? ' Reintentando...' : ' Cerrá otras apps/pestañas que usen la cámara e intentá de nuevo.'}
                  </p>
                  <button
                    onClick={handleManualRetry}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                  >
                    <RefreshCw size={16} /> Reintentar
                  </button>
                </div>
              )}
              {/* La librería inyecta su propia UI (selector de cámara, zoom, linterna).
                  Se envuelve en una caja clara porque su estilo por defecto usa texto oscuro. */}
              <div id={SCANNER_ELEMENT_ID} className="w-full rounded-xl overflow-hidden bg-slate-100 [color-scheme:light]" />
              <p className="text-xs text-slate-500 text-center mt-3">
                Si no enfoca bien, usá el selector de cámara para probar otra lente (algunos celulares tienen varias) y ajustá el zoom.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;

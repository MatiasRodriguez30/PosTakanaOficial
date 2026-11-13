import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5QrcodeScanType } from 'html5-qrcode';
import { X, Camera, AlertTriangle, RefreshCw } from 'lucide-react';

const SCANNER_ELEMENT_ID = 'barcode-scanner-viewport';
const HEADER_MESSAGE_ID = `${SCANNER_ELEMENT_ID}__header_message`;
const MAX_AUTO_RETRIES = 2;
const STORAGE_KEY = 'HTML5_QRCODE_DATA';
const FRONT_LABEL_RE = /front|user|frontal|delantera/i;
const BACK_LABEL_RE = /back|rear|trasera|environment/i;

const ensureBackCameraPreferred = async () => {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras || cameras.length < 2) return;

    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      /* ignorar */
    }
    const storedCam = stored?.lastUsedCameraId ? cameras.find((c) => c.id === stored.lastUsedCameraId) : null;
    if (storedCam && !FRONT_LABEL_RE.test(storedCam.label || '')) return;

    let backId = cameras.find((c) => BACK_LABEL_RE.test(c.label || ''))?.id;

    if (!backId) {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        backId = probe.getVideoTracks()[0]?.getSettings().deviceId;
        probe.getTracks().forEach((t) => t.stop());
      } catch (_) {
        /* fallback */
      }
    }

    if (!backId) {
      backId = (cameras.find((c) => !FRONT_LABEL_RE.test(c.label || '')) || cameras[cameras.length - 1])?.id;
    }

    if (backId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hasPermission: true, lastUsedCameraId: backId }));
    }
  } catch (_) {
    // Flujo normal
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

const BarcodeScannerModal = ({ onScan, onClose }) => {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [hardwareError, setHardwareError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const autoRetriesRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (window.isSecureContext === false) {
      setError('La cámara requiere una conexión segura (HTTPS). Abrí la app desde el enlace https://.');
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
          scanner
            .clear()
            .catch(() => {})
            .finally(() => onScan(decodedText));
        },
        () => {}
      );

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-escaner-titulo"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/75"
    >
      <div className="surface-card w-full max-w-sm shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h3 id="modal-escaner-titulo" className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Camera size={18} className="text-brand-700 dark:text-brand-400" />
            Escanear código
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar escáner"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {error ? (
            <div className="flex flex-col items-center text-center gap-3 py-6 text-slate-700 dark:text-slate-300">
              <AlertTriangle className="text-amber-600 dark:text-amber-400" size={36} />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              {hardwareError && (
                <div className="flex flex-col items-center text-center gap-3 py-4 mb-3 text-amber-950 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-300 dark:border-amber-700">
                  <AlertTriangle className="text-amber-700 dark:text-amber-400" size={28} />
                  <p className="text-xs px-3">
                    No se pudo iniciar la cámara (puede estar ocupada por otra app o pestaña).
                    {autoRetriesRef.current < MAX_AUTO_RETRIES
                      ? ' Reintentando...'
                      : ' Cerrá otras apps que usen la cámara e intentá de nuevo.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleManualRetry}
                    className="btn-brand flex items-center gap-2 px-4 py-2 text-xs"
                  >
                    <RefreshCw size={14} /> Reintentar
                  </button>
                </div>
              )}
              <div id={SCANNER_ELEMENT_ID} className="w-full rounded-lg overflow-hidden bg-slate-100 [color-scheme:light]" />
              <p className="text-xs text-slate-600 dark:text-slate-400 text-center mt-3">
                Si no enfoca bien, usá el selector de cámara para probar otra lente y ajustá el zoom.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;

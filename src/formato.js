const TZ_AR = 'America/Argentina/Buenos_Aires';

const formatoARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoFechaHoraAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: TZ_AR,
  dateStyle: 'short',
  timeStyle: 'short',
});

const formatoFechaDiaAR = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ_AR,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatearPesos(valor) {
  const num = Number(valor);
  return formatoARS.format(Number.isFinite(num) ? num : 0);
}

export function formatearCantidad(valor) {
  const num = Number(valor);
  if (!Number.isFinite(num)) return '0';
  return String(Number(num.toFixed(3))).replace('.', ',');
}

// El backend guarda fechas en UTC sin sufijo "Z". Si viene sin zona horaria,
// la interpretamos como UTC para convertirla correctamente a hora Argentina.
export function parsearFechaUTC(iso) {
  if (!iso) return null;
  if (iso instanceof Date) return Number.isNaN(iso.getTime()) ? null : iso;
  const texto = String(iso).trim();
  const tieneZona = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto);
  const fecha = new Date(tieneZona ? texto : `${texto}Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function formatearFechaHora(iso) {
  const fecha = parsearFechaUTC(iso);
  if (!fecha) return '—';
  return formatoFechaHoraAR.format(fecha);
}

export function claveDiaArgentina(fechaOIso) {
  const fecha = parsearFechaUTC(fechaOIso);
  if (!fecha) return '';
  return formatoFechaDiaAR.format(fecha);
}

export function esHoyArgentina(iso) {
  const dia = claveDiaArgentina(iso);
  if (!dia) return false;
  return dia === claveDiaArgentina(new Date());
}

export function esUltimosDiasArgentina(iso, dias = 7) {
  const fecha = parsearFechaUTC(iso);
  if (!fecha) return false;
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
  return fecha.getTime() >= limite;
}

// ─── Sonido de escáner ──────────────────────────────────────────────────────

const CLAVE_SONIDO = 'TAKANA_SONIDO_ESCANEO';
let audioCtx = null;

export function leerSonidoEscaneo() {
  try {
    const guardado = localStorage.getItem(CLAVE_SONIDO);
    return guardado === null ? true : guardado === 'true';
  } catch {
    return true;
  }
}

export function guardarSonidoEscaneo(activo) {
  try {
    localStorage.setItem(CLAVE_SONIDO, activo ? 'true' : 'false');
  } catch {
    // ignorar si storage está bloqueado
  }
}

export function reproducirBeepEscaneo(exito = true) {
  if (!leerSonidoEscaneo()) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const ahora = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(exito ? 1280 : 340, ahora);

    const duracion = exito ? 0.075 : 0.14;
    gain.gain.setValueAtTime(0.001, ahora);
    gain.gain.linearRampToValueAtTime(0.12, ahora + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, ahora + duracion);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(ahora);
    osc.stop(ahora + duracion + 0.01);
  } catch {
    // Navegador sin soporte o audio bloqueado
  }
}

// ─── Comprobante / Ticket térmico (58 / 80 mm) y WhatsApp ────────────────────

export function armarTextoTicket(venta) {
  if (!venta) return '';
  const lineas = [
    'TAKANA MASCOTA',
    'Comprobante de venta (no fiscal)',
    '--------------------------------',
  ];
  if (venta.nroRegistro) lineas.push(`Comprobante: #${venta.nroRegistro}`);
  lineas.push(`Fecha: ${formatearFechaHora(venta.fechaRegistro)}`);
  if (venta.vendedor) lineas.push(`Vendedor: ${venta.vendedor}`);
  if (venta.medioPago) lineas.push(`Pago: ${venta.medioPago}`);
  lineas.push('--------------------------------');

  for (const item of venta.items || []) {
    const cant = formatearCantidad(item.cantidad);
    const pres = item.presentacion ? ` (${item.presentacion})` : '';
    lineas.push(`${item.nombre}${pres}`);
    lineas.push(`  ${cant} x ${formatearPesos(item.precioUnitario)} = ${formatearPesos(item.subtotal)}`);
  }

  lineas.push('--------------------------------');
  lineas.push(`TOTAL: ${formatearPesos(venta.total)}`);

  if (venta.montoRecibido > 0 && venta.vuelto >= 0) {
    lineas.push(`Recibido: ${formatearPesos(venta.montoRecibido)}`);
    lineas.push(`Vuelto: ${formatearPesos(venta.vuelto)}`);
  }
  lineas.push('');
  lineas.push('¡Gracias por su compra!');
  return lineas.join('\n');
}

function escaparHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function imprimirTicket(venta) {
  if (!venta) return;
  const filasHtml = (venta.items || [])
    .map(
      (item) => `
      <div class="item">
        <div class="nombre">${escaparHtml(item.nombre)}${item.presentacion ? ` <span class="pres">(${escaparHtml(item.presentacion)})</span>` : ''}</div>
        <div class="calc">
          <span>${escaparHtml(formatearCantidad(item.cantidad))} x ${escaparHtml(formatearPesos(item.precioUnitario))}</span>
          <strong>${escaparHtml(formatearPesos(item.subtotal))}</strong>
        </div>
      </div>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${venta.nroRegistro ? `#${venta.nroRegistro}` : ''}</title>
  <style>
    @page { margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      margin: 0;
      padding: 4mm;
      width: 72mm;
      max-width: 100%;
    }
    .centro { text-align: center; }
    .titulo { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
    .sub { font-size: 10px; margin-top: 2px; }
    .sep { border-top: 1px dashed #000; margin: 8px 0; }
    .meta { font-size: 11px; }
    .meta div { display: flex; justify-content: space-between; gap: 8px; }
    .item { margin-bottom: 6px; }
    .nombre { font-weight: 600; word-break: break-word; }
    .pres { font-weight: 400; font-size: 11px; }
    .calc { display: flex; justify-content: space-between; font-size: 11px; font-variant-numeric: tabular-nums; }
    .total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
    .extra { display: flex; justify-content: space-between; font-size: 11px; font-variant-numeric: tabular-nums; margin-top: 2px; }
    .pie { text-align: center; font-size: 11px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="centro">
    <div class="titulo">TAKANA MASCOTA</div>
    <div class="sub">Comprobante de venta (no fiscal)</div>
  </div>
  <div class="sep"></div>
  <div class="meta">
    ${venta.nroRegistro ? `<div><span>Comprobante</span><span>#${escaparHtml(venta.nroRegistro)}</span></div>` : ''}
    <div><span>Fecha</span><span>${escaparHtml(formatearFechaHora(venta.fechaRegistro))}</span></div>
    ${venta.vendedor ? `<div><span>Vendedor</span><span>${escaparHtml(venta.vendedor)}</span></div>` : ''}
    ${venta.medioPago ? `<div><span>Pago</span><span>${escaparHtml(venta.medioPago)}</span></div>` : ''}
  </div>
  <div class="sep"></div>
  ${filasHtml}
  <div class="sep"></div>
  <div class="total">
    <span>TOTAL</span>
    <span>${escaparHtml(formatearPesos(venta.total))}</span>
  </div>
  ${
    venta.montoRecibido > 0 && venta.vuelto >= 0
      ? `<div class="extra"><span>Recibido</span><span>${escaparHtml(formatearPesos(venta.montoRecibido))}</span></div>
         <div class="extra"><span>Vuelto</span><span>${escaparHtml(formatearPesos(venta.vuelto))}</span></div>`
      : ''
  }
  <div class="pie">¡Gracias por su compra!</div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      setTimeout(() => iframe.remove(), 2000);
    }
  }, 150);
}

export function compartirWhatsApp(venta) {
  const texto = armarTextoTicket(venta);
  if (!texto) return;
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copiarTicket(venta) {
  const texto = armarTextoTicket(venta);
  if (!texto) return false;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

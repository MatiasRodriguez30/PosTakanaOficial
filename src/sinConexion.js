// Funcionamiento sin conexión: catálogo guardado en el equipo y cola de ventas
// cobradas sin internet, que se envían solas cuando vuelve la conexión.
//
// Todo vive en localStorage del equipo (en la app Android, el del WebView, que
// persiste aunque se cierre la app). Cada venta lleva un idCliente único: si
// se envía dos veces, el servidor devuelve la misma venta y no la duplica.
import { api } from './api';

const CLAVE_VENTAS = 'TAKANA_VENTAS_PENDIENTES';
const CLAVE_CATALOGO = 'TAKANA_CATALOGO';
export const EVENTO_VENTAS = 'takana-ventas-pendientes';

// ─── Catálogo ────────────────────────────────────────────────────────────────

export const guardarCatalogo = (datos) => {
  try {
    localStorage.setItem(CLAVE_CATALOGO, JSON.stringify({ ...datos, guardadoEn: new Date().toISOString() }));
  } catch (e) {
    console.error('No se pudo guardar el catálogo en el equipo', e);
  }
};

export const leerCatalogo = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CATALOGO)) || null;
  } catch {
    return null;
  }
};

// ─── Ventas pendientes ───────────────────────────────────────────────────────

export const leerVentasPendientes = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VENTAS)) || [];
  } catch {
    return [];
  }
};

const guardarVentas = (ventas) => {
  localStorage.setItem(CLAVE_VENTAS, JSON.stringify(ventas));
  window.dispatchEvent(new Event(EVENTO_VENTAS));
};

export const nuevoIdVenta = () =>
  (window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

export const encolarVenta = (venta) => guardarVentas([...leerVentasPendientes(), venta]);

export const descartarVenta = (idCliente) =>
  guardarVentas(leerVentasPendientes().filter(v => v.idCliente !== idCliente));

const cuerpoDeVenta = (venta) => ({
  idCliente: venta.idCliente,
  fechaRegistro: venta.fechaRegistro,
  codMedioPago: venta.codMedioPago,
  detalles: venta.detalles
});

let sincronizando = false;

// Envía las ventas pendientes de este usuario, de a una y en orden. Si no hay
// conexión o la sesión venció, corta y se reintenta más tarde. Si el servidor
// rechaza una venta (p. ej. un producto que ya no existe), la deja marcada con
// el error para que la persona decida, y sigue con las demás.
export const sincronizarVentas = async (username) => {
  if (sincronizando || !username) return;
  sincronizando = true;
  try {
    for (const venta of leerVentasPendientes()) {
      if (venta.usuario !== username) continue;
      try {
        await api.post('/api/registros', cuerpoDeVenta(venta));
        guardarVentas(leerVentasPendientes().filter(v => v.idCliente !== venta.idCliente));
      } catch (e) {
        if (e.sinConexion || e.status === 401) break;
        guardarVentas(leerVentasPendientes().map(v =>
          v.idCliente === venta.idCliente ? { ...v, error: e.message } : v));
      }
    }
  } finally {
    sincronizando = false;
  }
};

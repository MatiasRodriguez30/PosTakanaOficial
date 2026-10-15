import React, { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { leerVentasPendientes, sincronizarVentas, descartarVenta, EVENTO_VENTAS } from '../sinConexion';

const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const REINTENTO_MS = 30000;

// Barra superior: avisa si no hay conexión y cuántas ventas cobradas sin
// internet faltan enviar. Las envía sola al volver la conexión, al volver a la
// app y cada 30 s mientras haya pendientes.
const EstadoConexion = () => {
  const { user } = useContext(AuthContext);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState(() => leerVentasPendientes());
  const [enviando, setEnviando] = useState(false);
  const [verDetalle, setVerDetalle] = useState(false);

  const mias = pendientes.filter(v => v.usuario === user?.username);
  const conError = mias.filter(v => v.error);

  const enviar = useCallback(async () => {
    if (!user?.username) return;
    setEnviando(true);
    try {
      await sincronizarVentas(user.username);
    } finally {
      setEnviando(false);
    }
  }, [user?.username]);

  useEffect(() => {
    const actualizar = () => setPendientes(leerVentasPendientes());
    const alConectar = () => { setEnLinea(true); enviar(); };
    const alDesconectar = () => setEnLinea(false);
    const alVolver = () => { if (document.visibilityState === 'visible') enviar(); };
    window.addEventListener(EVENTO_VENTAS, actualizar);
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);
    document.addEventListener('visibilitychange', alVolver);
    enviar();
    return () => {
      window.removeEventListener(EVENTO_VENTAS, actualizar);
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [enviar]);

  useEffect(() => {
    if (mias.length === 0) return undefined;
    const reloj = setInterval(enviar, REINTENTO_MS);
    return () => clearInterval(reloj);
  }, [mias.length, enviar]);

  if (enLinea && mias.length === 0) return null;

  const descartar = (venta) => {
    const texto = `¿Descartar la venta de ${formatoMoneda.format(venta.total)} (${venta.resumen})?\n\n` +
      'No se va a registrar en el sistema. No se puede deshacer.';
    if (window.confirm(texto)) descartarVenta(venta.idCliente);
  };

  return (
    <div className="shrink-0 border-b border-amber-800/50 bg-amber-950/40 text-amber-100 text-sm z-30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
        {!enLinea && <span className="font-medium">Sin conexión. Podés seguir cobrando: las ventas se guardan en este equipo.</span>}
        {mias.length > 0 && (
          <span>
            {mias.length === 1 ? '1 venta sin enviar' : `${mias.length} ventas sin enviar`}
            {conError.length > 0 && <span className="text-red-300"> ({conError.length} con error)</span>}
          </span>
        )}
        {mias.length > 0 && (
          <span className="flex gap-2 ml-auto">
            <button
              onClick={enviar}
              disabled={enviando}
              className="px-3 py-1 rounded-md border border-amber-700/60 hover:bg-amber-900/40 disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
            <button
              onClick={() => setVerDetalle(v => !v)}
              className="px-3 py-1 rounded-md border border-amber-700/60 hover:bg-amber-900/40"
            >
              {verDetalle ? 'Ocultar' : 'Ver'}
            </button>
          </span>
        )}
      </div>
      {verDetalle && mias.length > 0 && (
        <ul className="px-4 pb-3 space-y-1.5 max-h-60 overflow-y-auto">
          {mias.map(v => (
            <li key={v.idCliente} className="flex items-start gap-3 rounded-md bg-slate-900/60 px-3 py-2 text-slate-200">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400 text-xs">
                    {new Date(v.fechaRegistro).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className="tabular-nums font-medium">{formatoMoneda.format(v.total)}</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{v.resumen}</p>
                {v.error && <p className="text-xs text-red-300 mt-0.5">No se pudo registrar: {v.error}</p>}
              </div>
              {v.error && (
                <button onClick={() => descartar(v)} className="text-xs text-red-300 hover:text-red-200 shrink-0 mt-0.5">
                  Descartar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EstadoConexion;

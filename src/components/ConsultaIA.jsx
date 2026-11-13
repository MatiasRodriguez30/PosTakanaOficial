import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { Bot, Send, User, Code2, Loader2, MessageSquare } from 'lucide-react';

const SUGERENCIAS = [
  '¿Cuántos productos tengo cargados?',
  '¿Cuál fue el total facturado hoy?',
  '¿Cuáles son los 5 productos más vendidos?',
  '¿Qué medio de pago se usa más?',
];

// Asistente de IA (Gemini) para hacer preguntas en lenguaje natural sobre toda
// la base de datos. Es de solo consulta: el backend nunca ejecuta nada que no
// sea un SELECT, así que esta pantalla no puede modificar ni borrar datos.
export default function ConsultaIA() {
  const [mensajes, setMensajes] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, loading]);

  const enviar = async (textoPregunta) => {
    const texto = (textoPregunta ?? pregunta).trim();
    if (!texto || loading) return;

    setMensajes((prev) => [...prev, { rol: 'user', texto }]);
    setPregunta('');
    setLoading(true);

    try {
      const data = await api.post('/api/ai/consulta', { pregunta: texto });
      setMensajes((prev) => [...prev, { rol: 'ia', texto: data.respuesta, sql: data.sql }]);
    } catch (e) {
      setMensajes((prev) => [
        ...prev,
        { rol: 'ia', texto: e.message || 'Ocurrió un error al consultar la IA', error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    enviar();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <Bot className="text-brand-700 dark:text-brand-400" size={22} />
          Asistente de Consultas
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm mt-0.5">
          Consultá datos sobre productos, ventas y medios de pago en lenguaje natural. Solo lectura: nunca modifica registros.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {mensajes.length === 0 && (
          <div className="surface-card flex flex-col items-center justify-center min-h-[260px] p-6 text-center gap-4">
            <MessageSquare size={36} className="text-slate-400" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Consultas rápidas sobre el negocio
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Elegí una pregunta sugerida o escribí la tuya abajo.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:border-brand-700 dark:hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.rol === 'ia' && (
              <div className="shrink-0 w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center">
                <Bot size={16} className="text-brand-700 dark:text-brand-300" />
              </div>
            )}

            <div
              className={`max-w-[85%] md:max-w-[75%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                m.rol === 'user'
                  ? 'bg-brand-700 text-white'
                  : m.error
                  ? 'bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                  : 'surface-card text-slate-900 dark:text-slate-100'
              }`}
            >
              {m.texto}
              {m.sql && (
                <details className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <summary className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
                    <Code2 size={13} /> Ver consulta SQL generada
                  </summary>
                  <pre className="mt-2 text-[11px] font-mono text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-2.5 overflow-x-auto">
                    {m.sql}
                  </pre>
                </details>
              )}
            </div>

            {m.rol === 'user' && (
              <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <User size={16} className="text-slate-700 dark:text-slate-200" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-center">
              <Bot size={16} className="text-brand-700 dark:text-brand-300" />
            </div>
            <div className="surface-card px-4 py-2.5 flex items-center gap-2 text-slate-600 dark:text-slate-300 text-sm">
              <Loader2 size={15} className="animate-spin text-brand-700 dark:text-brand-400" />
              Consultando base de datos...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-3 md:p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Escribí tu pregunta sobre el negocio…"
            disabled={loading}
            className="input-base h-11 flex-1"
          />
          <button
            type="submit"
            disabled={loading || !pregunta.trim()}
            aria-label="Enviar consulta"
            className="shrink-0 h-11 px-4 btn-brand flex items-center justify-center gap-2 text-sm"
          >
            <Send size={17} />
            <span className="hidden sm:inline">Consultar</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// El visor ciudadano solo puede consultar resultados; no ejecuta agentes ni envíos.
export function apiSoloLectura(cliente) {
  return new Proxy(cliente, {
    get(target, nombre) {
      const valor = target[nombre];
      if (typeof valor !== 'function' || String(nombre).startsWith('get')) return valor;
      return async () => { throw new Error('Vista de seguimiento: esta acción corresponde al legislador.'); };
    },
  });
}

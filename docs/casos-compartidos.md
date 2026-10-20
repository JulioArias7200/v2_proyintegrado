# Casos compartidos y derivación ciudadana

Los casos se guardan en `casos_compartidos` de MongoDB Atlas. El navegador conserva una copia local y sincroniza los cambios al terminar cada agente. Si otro equipo modificó el mismo caso, el servidor rechaza la escritura anterior para evitar sobreescrituras; la pantalla indica que debe actualizarse. Todos los usuarios autenticados pueden consultar la lista común.

El ciudadano presenta una consulta o iniciativa desde Atención Ciudadana o desde el panel del asistente de Interacción Ciudadana. Selecciona Diputados, Senadores o ambas cámaras. La presentación se registra antes de iniciar los agentes y continúa en el backend aunque se cierre el navegador.

- Consulta: Distribuidor y Concentrador, sin tratar una consulta como proyecto de ley.
- Iniciativa: Distribuidor, Comisión, Constitucional, Consistencia y Concentrador (agente 5), sin confirmaciones humanas intermedias. Al presentar se abre automáticamente el seguimiento. Si una auditoría queda pendiente, se conserva como insumo incompleto de confianza cero y se concentra con un aviso visible, sin presentarla como conclusión verificada.
- Al terminar el Concentrador, el expediente queda pendiente de seguimiento. Solo Diputados y Senadores pueden ejecutar Secretario, Bicameral, Veto/Promulgación y Publicación. No se aprueba ni se promulga automáticamente.

La elección de cámara es el destino de la bandeja compartida; no equivale a un correo enviado. Los correos de aprobación bicameral y de publicación siguen siendo acciones diferentes.

El ciudadano tiene el acceso «Ver agentes, flujo y observaciones», y cada caso incluye «Ver flujo y observaciones». Abre las mismas pantallas de Mesa de Partes en modo de lectura: puede inspeccionar agentes, resultados y observaciones, con actualización cada tres segundos. No modifica el expediente, aprueba decisiones ni despacha correos desde ese visor. Puede solicitar la reanudación automática de sus propias auditorías detenidas. Mientras se procesa una presentación, el servidor publica los agentes activos y cada resultado de auditoría al terminar.

## Acceso desde otros equipos

Todos deben entrar al mismo servidor. `127.0.0.1` apunta al equipo de cada usuario y no sirve como dirección compartida.

En el equipo servidor, usando el entorno Python del proyecto:

```powershell
cd "C:\Users\Patito\Documents\Holiwi\v2_proyintegrado"
py -m uvicorn server:app --host 0.0.0.0 --port 8085
```

En otra terminal:

```powershell
cd "C:\Users\Patito\Documents\Holiwi\v2_proyintegrado\frontend"
npm run dev
```

`py server.py` también usa el puerto 8085 por defecto. Si se establece `PORT` o se inicia Uvicorn en otro puerto, crear `frontend/.env.local` con `VITE_BACKEND_TARGET=http://127.0.0.1:PUERTO` y reiniciar Vite. `ECONNREFUSED 127.0.0.1:8085` significa que el proxy no encuentra un backend escuchando allí; iniciar solo Vite no inicia Python.

En un caso legislativo detenido sin resultados, el autor o un legislador puede usar «Reanudar auditorías de este caso». Conserva el expediente y vuelve a ejecutar Comisión, ambas auditorías y Concentrador. Se rechazan ejecuciones simultáneas y casos que ya avanzaron al seguimiento legislativo. Los registros del backend muestran `INICIO agente=constitucional`, `INICIO agente=consistencia` y su fin o error. Estas ejecuciones automáticas son llamadas internas del servidor, sin POST separado por agente en el navegador.

Desde los demás equipos de la misma red, abrir `http://IP_DEL_SERVIDOR:5173`. Vite deriva `/api` y `/uploaded_files` al backend. El servidor debe permanecer encendido y su firewall permitir el acceso al puerto del frontend.

Para un despliegue público, usar un dominio HTTPS y un proxy que derive `/api` y `/uploaded_files` al backend. Si el frontend y backend se publican en dominios diferentes, configurar `VITE_API_BASE_URL=https://DOMINIO_BACKEND/api` antes de compilar. Esta implementación no publica el servicio en Internet por sí sola.

Los PDF continúan alojados en el servidor central. Ejecutar backends separados en varios equipos no comparte sus archivos locales. Si el servidor se reinicia durante una presentación en proceso, sus resultados ya guardados permanecen, pero el trabajo en segundo plano no se reanuda automáticamente. La sesión de autenticación actual también requiere volver a iniciar sesión tras reiniciar el backend.

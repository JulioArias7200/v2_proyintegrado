# Recuperación de la auditoría constitucional

Los errores `ResourceExhausted`, HTTP 503 y `ReadTimeout` del registro del
21 de octubre de 2026 corresponden a solicitudes a NVIDIA. No acreditan una
conclusión jurídica sobre el proyecto. Las pruebas del proveedor realizadas
durante la corrección también encontraron tiempos de espera en consultas
mínimas y un respaldo del catálogo sin acceso para la cuenta.

## Cambios

- Los candidatos constitucionales de un párrafo se cotejan juntos en una
  llamada estructurada. Clasificación, fundamento, citas y recomendación se
  validan sin varias rondas redundantes por candidato.
- Las citas de relaciones favorables, contrarias o que requieren análisis de
  fondo deben existir literalmente en las fuentes entregadas. Las respuestas
  omitidas, duplicadas o no verificadas permanecen pendientes.
- Los resultados completos se reutilizan durante 30 minutos en la memoria
  del proceso, hasta 2048 entradas. El hash incluye párrafo, número y texto
  constitucional. Cambiar el documento o la fuente impide reutilizarlos.
  Reiniciar el backend vacía esta caché. No se guardan fallos como éxitos.
- Las auditorías excluyen el modelo Omni de los respaldos y priorizan modelos
  de texto. Un HTTP 429/503 suspende temporalmente el modelo respetando el
  `Retry-After` numérico. No se considera retirada permanente del modelo.
- Se omiten solicitudes cuando quedan menos de ocho segundos de presupuesto;
  no se intentan cotejos nuevos con tiempos de lectura de milisegundos.
- El cotejo solicita razonamiento breve solo a GPT-OSS, mediante
  [`reasoning_effort=low`](https://docs.api.nvidia.com/nim/reference/openai-gpt-oss-20b-infer).
  Este parámetro no se envía a otros modelos de respaldo.
- Si existen pendientes, tanto la confianza general como la del resumen son
  cero. El riesgo queda desconocido y el registro indica el estado pendiente.

## Aplicación

Reinicia el backend para cargar los cambios y reintenta la auditoría desde la
pantalla del mismo caso. Si el proveedor continúa sin responder, el sistema
conservará el estado pendiente. Los cotejos completados en ese proceso se
reutilizan en el siguiente intento; los pendientes requieren que NVIDIA
vuelva a responder o una revisión jurídica manual.

## Verificación local

```powershell
python -m unittest test_cotejo_constitucional test_auditoria_timeouts test_facetas_semanticas test_reglamentos_profesionales -v
```

Estas pruebas simulan las respuestas externas: verifican lotes, citas,
recuperación parcial, caché, límites de tiempo, saturación y confianza. No
demuestran disponibilidad continua del servicio NVIDIA.

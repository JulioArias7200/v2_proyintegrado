# Base profesional del asistente multifacético

Los reglamentos se guardan en `sistema.reglamentos_profesionales`, en Neon.
Cada fragmento conserva profesión, título, archivo, hash SHA-256 y página del
PDF. Los demás equipos consultan la misma tabla; no necesitan los PDF locales.
La carpeta `Documeno/` queda fuera de Git. Los fragmentos tienen también un
vector `embedding`, el modelo, su dimensión y el hash del texto vectorizado.
Se reutiliza el cliente NVIDIA del sistema con `nvidia/nemotron-3-embed-1b`
(2048 dimensiones), `passage` para las normas y `query` para las consultas.

## Carga inicial

Desde la raíz del proyecto y con el entorno Python del backend activo:

```powershell
python cargar_reglamentos_profesionales.py
```

Carga los cuatro documentos de `Documeno`: abogacía, arquitectura, medicina y
seguridad ciudadana. La operación es idempotente: no duplica fragmentos del
mismo PDF. Al cambiar el contenido de un archivo, publica la nueva versión y
desactiva los fragmentos anteriores al completar la carga. Rechaza PDF con
páginas sin texto suficiente; en ese caso aplica OCR antes de cargarlo.

Para vectorizar o reanudar únicamente los fragmentos ya cargados:

```powershell
python cargar_reglamentos_profesionales.py --solo-embeddings
```

Los vectores válidos del mismo modelo y contenido se reutilizan. Al cambiar
de modelo o dimensión, ejecuta este comando antes de consultar; la búsqueda
rechaza un índice incompleto o incompatible y lo informa como pendiente.

## Agregar otra profesión o reglamento

```powershell
python cargar_reglamentos_profesionales.py --archivo "Documeno\ingenieros.pdf" --profesion "Ingeniería civil" --titulo "Título exacto de la norma del PDF" --alias "ingeniero" --alias "ingenieros" --alias "ingeniería civil"
```

El título y los alias se proporcionan explícitamente. No se deduce una norma
ni su vigencia del nombre de archivo. La carga registra también la faceta en
el catálogo del asistente. Los alias sirven como metadatos del catálogo;
la recuperación operativa compara vectores y no exige coincidencia literal.

## Funcionamiento

- El chat busca por similitud coseno en pgvector. Las respuestas reciben fuentes identificadas como
  `[R1]`, `[R2]`, etc.; el frontend muestra el archivo y la página PDF.
- Al subir un documento, tanto en el chat como en Mesa de Partes, se generan
  vectores de sus bloques y se recuperan candidatos de todas las profesiones.
  Un selector confirma qué facetas son pertinentes, con motivo y cita literal
  del documento. Puede seleccionar varias o ninguna; no asigna Abogacía solo
  por tratarse de un proyecto de ley.
- Cada faceta seleccionada emite su propio aporte con las fuentes de su área
  (hasta dos facetas simultáneas). La numeración de las referencias se conserva
  al reunir los aportes. Las intervenciones quedan trazadas en MongoDB.
- El Concentrador aplica el mismo análisis semántico al documento vigente y
  recibe el informe conjunto de las facetas. Cambiar el archivo requiere un
  nuevo análisis; no se aceptan dictámenes profesionales aportados por el cliente.
- El Concentrador recibe el informe como orientación complementaria. Lo
  conserva en el expediente, lo muestra en su pantalla y lo incluye como
  anexo del PDF. No lo convierte en cotejos verificados ni altera por ello el
  riesgo de las auditorías constitucional y normativa.
- Una falla de Neon o del modelo se informa como revisión pendiente; no se
  registra como aprobación. Un documento sin relación devuelve `NO_APLICA`.
- Los logos utilizan imágenes reales en rutas web. El JPG incluido reutiliza
  la imagen institucional del agente ciudadano disponible en el proyecto.

`PROFESIONAL_SIMILITUD_MINIMA` permite ajustar el umbral de candidatos
(predeterminado `0.15`). La similitud no representa una probabilidad. Un LLM
confirma pertinencia y su evidencia debe existir literalmente en el documento.
Los documentos se recorren en bloques de 4000 caracteres; por encima de 64
bloques se utiliza una muestra distribuida que incluye el inicio y el final.
El resultado informa `cobertura_parcial` y las pantallas lo muestran.

La generación de embeddings envía los fragmentos de las normas y del documento
a NVIDIA. Neon almacena los vectores de las normas; los vectores de consulta
se usan durante la petición y no se incorporan al corpus normativo.

Reinicia el backend después de actualizar el código. Para producción,
compila y publica también el frontend (`npm run build`).

# TomatoScan IA — prototipo PWA

## Qué funciona
- Cámara frontal/trasera mediante `getUserMedia` (sujeto a permisos y disponibilidad).
- Análisis en vivo de **regiones de color** verde, naranja y rojo mediante Canvas.
- Recuadros, etiquetas y conteos de regiones de color (NO conteo confiable de tomates).
- PWA con iconos, manifiesto y service worker para GitHub Pages.
- Interfaz adaptable a Android y iOS.

## Qué NO funciona todavía
- **No incluye un modelo de IA entrenado para detectar tomates**. Un objeto rojo, naranja o verde puede producir un falso positivo.
- No reconoce con fiabilidad la madurez, especie, calidad o estado de un tomate.
- No hay identificación individual fiable cuando se solapan objetos.
- La maduración real no se determina solo por color; también influyen variedad e iluminación.

## Publicar en GitHub Pages
1. Crea un repositorio público en GitHub (por ejemplo `tomatoscan-ia`).
2. Sube **todos los archivos de esta carpeta a la raíz** del repositorio (no subas solo el ZIP).
3. En el repositorio ve a **Settings → Pages → Build and deployment**.
4. Selecciona **Deploy from a branch**, rama `main`, carpeta `/(root)` y guarda.
5. Espera a que GitHub Pages publique la dirección `https://USUARIO.github.io/tomatoscan-ia/` (sustituye USUARIO).
6. Abre el enlace en Chrome Android o Safari iOS, acepta el permiso de cámara y pulsa «Iniciar cámara».
7. Android: menú de Chrome → «Agregar a pantalla principal» o «Instalar aplicación».
8. iOS: Safari → Compartir → «Agregar a pantalla de inicio».

Si actualizas los archivos y no ves los cambios, recarga la página; el service worker puede conservar una versión anterior.

## Probar localmente
Desde la carpeta ejecuta `python -m http.server 8000` y abre `http://localhost:8000`. Para usarlo en un teléfono distinto se requiere HTTPS.

## Próximo paso para IA auténtica
1. Reunir y etiquetar imágenes de tomates en 3 clases: verde, madurando, maduro; incluir distintos fondos, iluminaciones y tamaños.
2. Entrenar o conseguir un modelo de **detección de objetos** compatible y revisar su licencia.
3. Exportarlo a ONNX o TensorFlow.js y añadir su runtime/modelo al proyecto.
4. Sustituir la función `analyze()` basada en color por inferencia del modelo, con postprocesamiento (confidence, NMS, coordenadas y clases).
5. Validar precisión, falsos positivos y rendimiento en Android e iOS reales. No asumir que cualquier modelo existente tiene las mismas clases o formato de salida.

Este repositorio es un prototipo funcional de interfaz y segmentación de color, no un detector IA de tomates ya terminado.

'use strict';
const $ = id => document.getElementById(id);
const video = $('video'), overlay = $('overlay'), ctx = overlay.getContext('2d');
const work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
let stream = null, facing = 'environment', timer = null, busy = false;

const COLORS = [
    { key: 'green', name: 'Verde', rgb: '#64e991' },
    { key: 'turning', name: 'Madurando', rgb: '#ffc06b' },
    { key: 'red', name: 'Maduro', rgb: '#ff7777' }
];

function state(msg) { 
    $('status').textContent = msg; 
}

function clear() { 
    ctx.clearRect(0, 0, overlay.width, overlay.height); 
    for (const c of COLORS) $(c.key).textContent = '0'; 
}

async function start() { 
    stop(); 
    if (!navigator.mediaDevices?.getUserMedia) { 
        state('Navegador no compatible'); 
        return; 
    } 
    try { 
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: false, 
            video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } } 
        }); 
        video.srcObject = stream; 
        await video.play(); 
        $('hint').hidden = true; 
        $('start').disabled = true; 
        $('switch').disabled = false; 
        $('stop').disabled = false; 
        state('Analizando colores'); 
        timer = setInterval(analyze, 420); 
    } catch (err) { 
        state('No se pudo abrir la cámara'); 
        $('message').textContent = `Comprueba permisos, HTTPS y disponibilidad de cámara (${err.name}).`; 
        stop(); 
    } 
}

function stop() { 
    if (timer) { 
        clearInterval(timer); 
        timer = null; 
    } 
    if (stream) { 
        stream.getTracks().forEach(t => t.stop()); 
        stream = null; 
    } 
    video.srcObject = null; 
    $('start').disabled = false; 
    $('switch').disabled = true; 
    $('stop').disabled = true; 
    $('hint').hidden = false; 
    clear(); 
}

$('start').addEventListener('click', start); 
$('stop').addEventListener('click', () => { stop(); state('Detenida'); }); 
$('switch').addEventListener('click', () => { 
    facing = facing === 'environment' ? 'user' : 'environment'; 
    start(); 
});

function classify(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b); 
    if (max - min < 36 || max < 55) return -1; // rechaza grises y oscuros
    if (g > r * 1.16 && g > b * 1.12 && g > 72) return 0; // Verde
    if (r > 105 && r > g * 1.18 && r > b * 1.35) return 2; // Maduro (Rojo)
    if (r > 120 && g > 55 && r > g * 1.07 && g > b * 1.4 && r < g * 2.9) return 1; // Madurando
    return -1;
}

function analyze() {
    if (busy || !stream || video.readyState < 2) return; 
    busy = true; 
    try {
        const W = 160, H = Math.max(100, Math.round(160 * video.videoHeight / video.videoWidth)); 
        work.width = W; 
        work.height = H; 
        wctx.drawImage(video, 0, 0, W, H); 
        const frameData = wctx.getImageData(0, 0, W, H);
        const data = frameData.data; 

        // 1. APLICAR EFECTO DE PSEUDOCOLOR (Estilo mapa de calor)
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const v = (r * 0.299 + g * 0.587 + b * 0.114); // Luminancia

            let nr, ng, nb;
            if (v < 64) {
                nr = 0; ng = Math.round(v * 4); nb = Math.round(255 - v * 2);
            } else if (v < 128) {
                nr = Math.round((v - 64) * 4); ng = 255; nb = 0;
            } else if (v < 192) {
                nr = 255; ng = Math.round(255 - (v - 128) * 4); nb = 0;
            } else {
                nr = 255; ng = Math.round((v - 192) * 4); nb = Math.round((v - 192) * 4);
            }
            data[i] = nr; data[i + 1] = ng; data[i + 2] = nb;
        }

        // Devolver los píxeles transformados al canvas de trabajo oculto
        wctx.putImageData(frameData, 0, 0);

        // Sincronizar el overlay visual con el tamaño real del video
        overlay.width = video.videoWidth; 
        overlay.height = video.videoHeight; 
        ctx.clearRect(0, 0, overlay.width, overlay.height); 

        // DIBUJAR EL FONDO CON PSEUDOCOLOR ESCALADO A TODA LA PANTALLA
        ctx.drawImage(work, 0, 0, overlay.width, overlay.height);

        // 2. PROCESAR MÁSCARAS Y DETECCIONES DE COLOR
        const masks = COLORS.map(() => new Uint8Array(W * H)); 
        for (let y = 0; y < H; y += 2) {
            for (let x = 0; x < W; x += 2) { 
                const p = (y * W + x) * 4;
                // Usamos los datos originales transformados o una clasificación basada en los nuevos colores
                const c = classify(data[p], data[p + 1], data[p + 2]); 
                if (c < 0) continue; 
                for (let dy = 0; dy < 2 && y + dy < H; dy++) {
                    for (let dx = 0; dx < 2 && x + dx < W; dx++) {
                        masks[c][(y + dy) * W + x + dx] = 1; 
                    }
                }
            }
        }
        
        const detections = []; 
        for (let c = 0; c < 3; c++) { 
            const mask = masks[c], visited = new Uint8Array(W * H); 
            for (let y = 0; y < H; y += 2) {
                for (let x = 0; x < W; x += 2) { 
                    const seed = y * W + x; 
                    if (!mask[seed] || visited[seed]) continue; 
                    let stack = [seed], count = 0, minx = W, maxx = 0, miny = H, maxy = 0; 
                    visited[seed] = 1; 
                    while (stack.length) { 
                        const p = stack.pop(), px = p % W, py = (p / W) | 0; 
                        count++; 
                        minx = Math.min(minx, px); maxx = Math.max(maxx, px); 
                        miny = Math.min(miny, py); maxy = Math.max(maxy, py); 
                        for (const n of [p - 1, p + 1, p - W, p + W]) { 
                            if (n < 0 || n >= W * H || visited[n] || !mask[n]) continue; 
                            if (Math.abs(n % W - px) + Math.abs(((n / W) | 0) - py) !== 1) continue; 
                            visited[n] = 1; stack.push(n); 
                        } 
                    } 
                    const bw = maxx - minx + 1, bh = maxy - miny + 1, area = bw * bh, fill = count / area; 
                    if (count >= Math.max(65, W * H * .003) && bw > 8 && bh > 8 && fill > .26 && bw / bh > .38 && bw / bh < 2.7) {
                        detections.push({ c, x: minx, y: miny, w: bw, h: bh, area }); 
                    }
                } 
            } 
        }
        
        detections.sort((a, b) => b.area - a.area); 
        const selected = detections.slice(0, 15); 
        const totals = [0, 0, 0]; 
        ctx.font = `bold ${Math.max(15, Math.round(overlay.width / 42))}px system-ui`; 
        ctx.lineWidth = Math.max(2, overlay.width / 400); 
        
        // DIBUJAR CAJAS DE DETECCIÓN ENCIMA
        for (const d of selected) { 
            totals[d.c]++; 
            const sx = overlay.width / W, sy = overlay.height / H, x = d.x * sx, y = d.y * sy, w = d.w * sx, h = d.h * sy, color = COLORS[d.c]; 
            ctx.strokeStyle = color.rgb; 
            ctx.strokeRect(x, y, w, h); 
            const label = `Zona ${color.name.toLowerCase()}`; 
            const textW = ctx.measureText(label).width + 12; 
            ctx.fillStyle = '#07140de8'; 
            ctx.fillRect(x, Math.max(0, y - 29), textW, 28); 
            ctx.fillStyle = color.rgb; 
            ctx.fillText(label, x + 6, Math.max(19, y - 8)); 
        } 
        
        COLORS.forEach((c, i) => $(c.key).textContent = totals[i]); 
        $('message').textContent = selected.length ? `${selected.length} regiones de color detectadas.` : 'No se encontraron regiones de color.';
    } catch (e) { 
        state('Error al analizar'); 
        console.error(e); 
    } finally { 
        busy = false; 
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}function aplicarPseudocolor() {
    if (video.paused || video.ended) return;


    const W = 200; 
    const H = Math.round(W * (video.videoHeight / video.videoWidth));
    work.width = W;
    work.height = H;
    
    wctx.drawImage(video, 0, 0, W, H);
    const frameData = wctx.getImageData(0, 0, W, H);
    const pixels = frameData.data;

 
    for (let i = 0; i < pixels.length; i += 4) {
      
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const v = (r * 0.299 + g * 0.587 + b * 0.114); // Intensidad de 0 a 255

      
        let nr, ng, nb;
        if (v < 64) {
            nr = 0;
            ng = Math.round(v * 4);
            nb = Math.round(255 - v * 2);
        } else if (v < 128) {
            nr = Math.round((v - 64) * 4);
            ng = 255;
            nb = 0;
        } else if (v < 192) {
            nr = 255;
            ng = Math.round(255 - (v - 128) * 4);
            nb = 0;
        } else {
            nr = 255;
            ng = Math.round((v - 192) * 4);
            nb = Math.round((v - 192) * 4);
        }

        pixels[i] = nr;     // Nuevo Rojo
        pixels[i + 1] = ng; // Nuevo Verde
        pixels[i + 2] = nb; // Nuevo Azul
    }

  
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    
   
    ctx.putImageData(frameData, 0, 0); // O puedes dibujarlo usando un canvas intermedio escalado

    requestAnimationFrame(aplicarPseudocolor);
}

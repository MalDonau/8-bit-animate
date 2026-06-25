import React from 'react';

// Icons reused from the app's toolbar / timeline so the help matches what's on screen.
const I = {
  brush: (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M497.9 142.1l-46.1 46.1c-4.7 4.7-12.3 4.7-17 0l-111-111c-4.7-4.7-4.7-12.3 0-17l46.1-46.1c18.7-18.7 49.1-18.7 67.9 0l60.1 60.1c18.8 18.7 18.8 49.1 0 67.9zM284.2 99.8L21.6 362.4.4 483.9c-2.9 16.4 11.4 30.6 27.8 27.8l121.5-21.3 262.6-262.6c4.7-4.7 4.7-12.3 0-17l-111-111c-4.8-4.7-12.4-4.7-17.1 0zM124.1 339.9c-5.5-5.5-5.5-14.3 0-19.8l154-154c5.5-5.5 14.3-5.5 19.8 0s5.5 14.3 0 19.8l-154 154c-5.5 5.5-14.3 5.5-19.8 0zM88 424h48v36.3l-64.5 11.3-31.1-31.1L51.7 376H88v48z" /></svg>
  ),
  eraser: (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M497.941 273.941c18.745-18.745 18.745-49.137 0-67.882l-160-160c-18.745-18.745-49.136-18.746-67.883 0l-256 256c-18.745 18.745-18.745 49.137 0 67.882l96 96A48.004 48.004 0 0 0 144 480h356c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12H355.883l142.058-142.059zm-302.627-62.627l137.373 137.373L265.373 416H150.628l-80-80 124.686-124.686z" /></svg>
  ),
  fill: (
    <svg viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M512 320s-64 92.65-64 128c0 35.35 28.66 64 64 64s64-28.65 64-64-64-128-64-128zm-9.37-79.43L294.74 32.71c-12.5-12.5-32.76-12.5-45.26 0l-78.06 78.07-72.41-72.41-22.62 22.62 72.41 72.41L17.37 263.43c-12.5 12.5-12.5 32.76 0 45.26l190.86 190.86c12.5 12.5 32.76 12.5 45.26 0l249.14-249.14c12.5-12.51 12.5-32.76 0-45.26zM437.94 256H80l178.97-178.97L437.94 256z" /></svg>
  ),
  eyedropper: (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M50.75 333.25c-12 12-18.75 28.28-18.75 45.26V424L0 480l32 32 56-32h45.49c16.97 0 33.25-6.74 45.25-18.74l129.32-129.32-128-128L50.75 333.25zM483.88 28.12c-37.47-37.5-98.28-37.5-135.75 0l-77.09 77.09-13.1-13.1c-9.44-9.44-24.65-9.31-33.94 0l-40.97 40.97c-9.37 9.37-9.37 24.57 0 33.94l161.94 161.94c9.44 9.44 24.65 9.31 33.94 0L419.88 288c9.37-9.37 9.37-24.57 0-33.94l-13.1-13.1 77.09-77.09c37.51-37.48 37.51-98.28.01-135.75z" /></svg>
  ),
  duplicate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  clear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="8" y1="8" x2="16" y2="16" /><line x1="16" y1="8" x2="8" y2="16" /></svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
  ),
  melody: (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M470.38 1.51L150.41 96A32 32 0 0 0 128 126.51v261.41A139 139 0 0 0 96 384c-53 0-96 28.66-96 64s43 64 96 64 96-28.66 96-64V214.32l256-75v184.61a138.4 138.4 0 0 0-32-3.93c-53 0-96 28.66-96 64s43 64 96 64 96-28.65 96-64V32a32 32 0 0 0-41.62-30.49z" /></svg>
  ),
  drum: (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><ellipse cx="256" cy="250" rx="160" ry="58" /><path d="M96 250 v116 a160 58 0 0 0 320 0 V250 Z" /><line x1="296" y1="205" x2="128" y2="78" stroke="currentColor" strokeWidth="30" strokeLinecap="round" /><line x1="216" y1="205" x2="384" y2="78" stroke="currentColor" strokeWidth="30" strokeLinecap="round" /></svg>
  ),
};

const Item: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="help-item">
    <div className="help-icon">{icon}</div>
    <div className="help-text">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  </div>
);

// A plain text/emoji chip for controls that use a glyph instead of an SVG.
const Glyph: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={`help-glyph ${className || ''}`}>{children}</span>
);

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <h2>Cómo usar 8-BIT ANIMATE</h2>
          <button className="help-close" onClick={onClose}>×</button>
        </div>

        <div className="help-body">
          <p className="help-intro">
            Dibujás pixel art cuadro a cuadro y la app lo convierte en animación <em>y</em> en música.
            Acá va todo, de lo más simple a lo más avanzado.
          </p>

          <h3>1 · Lo básico: dibujar</h3>
          <Item icon={<Glyph>✏️</Glyph>} title="Pintar">
            Tocá (o hacé clic) sobre el lienzo, o arrastrá para pintar varias celdas con el color actual.
          </Item>
          <Item icon={I.brush} title="Pincel (B)">
            La herramienta normal para pintar celda por celda.
          </Item>
          <Item icon={I.eraser} title="Goma (E)">
            Borra celdas y las deja transparentes. En PC también borrás con el clic derecho.
          </Item>
          <Item icon={I.fill} title="Relleno (F)">
            Rellena de un golpe toda un área conectada del mismo color (como el balde de pintura).
          </Item>
          <Item icon={I.eyedropper} title="Gotero">
            Toma un color que ya está en el dibujo para seguir pintando con él. En PC: <b>Alt + clic</b>.
          </Item>

          <h3>2 · Color</h3>
          <Item icon={<Glyph>🎨</Glyph>} title="Elegir de la paleta">
            Tocá un color de la paleta para seleccionarlo (suena un adelanto de cómo va a sonar).
          </Item>
          <Item icon={<Glyph>＋</Glyph>} title="Color personalizado">
            El selector de color (cuadrito de color) te deja elegir cualquier tono que quieras.
          </Item>
          <Item icon={<Glyph>⬛</Glyph>} title="Color de fondo del lienzo">
            Mantené presionado un color de la paleta ~2 segundos y ese color pasa a ser el fondo del lienzo.
          </Item>

          <h3>3 · Vista</h3>
          <Item icon={<Glyph>▦</Glyph>} title="Grilla">
            Muestra u oculta la cuadrícula guía. No se exporta salvo que lo pidas.
          </Item>
          <Item icon={<Glyph>🔍</Glyph>} title="Zoom">
            Acercá o alejá el lienzo con los botones – / +.
          </Item>
          <Item icon={<Glyph>🌓</Glyph>} title="Modo claro / oscuro y Audio">
            Cambian el tema visual y prenden/apagan el sonido.
          </Item>

          <h3>4 · Fotogramas (la tira de abajo)</h3>
          <Item icon={<Glyph>＋</Glyph>} title="Agregar fotograma">
            Crea un cuadro nuevo y vacío justo después del actual. Cada cuadro es un instante de la animación.
          </Item>
          <Item icon={<Glyph>👆</Glyph>} title="Seleccionar">
            Tocá una miniatura para editar ese cuadro.
          </Item>
          <Item icon={I.duplicate} title="Duplicar">
            Copia el cuadro actual (con melodía y ritmo). Ideal para hacer pequeños cambios entre cuadro y cuadro.
          </Item>
          <Item icon={I.clear} title="Borrar contenido">
            Vacía el cuadro <em>sin eliminarlo</em> de la tira. Borra solo la capa que estás viendo (melodía o ritmo).
          </Item>
          <Item icon={I.trash} title="Eliminar fotograma">
            Saca el cuadro de la animación (afecta melodía y ritmo a la vez).
          </Item>
          <Item icon={<Glyph>↔️</Glyph>} title="Mover de lugar">
            Arrastrá una miniatura para reordenar los cuadros.
          </Item>

          <h3>5 · Reproducción</h3>
          <Item icon={<Glyph>▶</Glyph>} title="Play">
            Reproduce la animación en bucle (y suena la música que generan tus dibujos).
          </Item>
          <Item icon={<Glyph>⏱</Glyph>} title="FPS (velocidad)">
            Cuántos cuadros por segundo. Más alto = animación más rápida.
          </Item>
          <Item icon={<Glyph>◎</Glyph>} title="Papel cebolla (onion skin)">
            Muestra como fantasmas los cuadros vecinos para que te guíes al dibujar el movimiento. Tocá para sumar
            más cuadros de referencia. (De paso, le agrega un eco al sonido.)
          </Item>
          <Item icon={<Glyph className="help-rec">●</Glyph>} title="REC">
            <b>ON</b>: tus trazos quedan guardados en el cuadro. <b>OFF</b>: los trazos se desvanecen al toque,
            para improvisar/tocar sin ensuciar el dibujo.
          </Item>

          <h3>6 · Sonido</h3>
          <Item icon={I.melody} title="Melodía / Ritmo">
            El interruptor ♪ / 🥁 elige qué capa dibujás y escuchás. Son dos capas independientes pero suenan
            <b> juntas</b> al reproducir. En la tira de cuadros ves solo la capa elegida.
          </Item>
          <Item icon={I.melody} title="Cómo suena la melodía">
            La <b>altura</b> (fila) define la nota (arriba más agudo). El <b>color</b> define el timbre, la
            <b> cantidad</b> de casillas del mismo color sube el volumen, y la posición <b>izquierda/derecha</b> el paneo.
          </Item>
          <Item icon={I.drum} title="Cómo suena el ritmo">
            Por color: oscuros y apagados = bombos y toms; tonos medios = redoblantes y palmas; colores vivos =
            metales y platillos. Más casillas = más fuerte; izquierda/derecha = paneo.
          </Item>
          <Item icon={<Glyph>∿</Glyph>} title="Glide">
            Con Glide activo, lo que pintás en <b>melodía</b> suena como una nota <em>sostenida</em> que se desliza
            (portamento) hacia la nota del cuadro siguiente. Y mientras dibujás, la nota sigue tu mano como un theremin.
            Apagado, las notas suenan sueltas como siempre.
          </Item>

          <h3>7 · Archivo</h3>
          <Item icon={<Glyph>🆕</Glyph>} title="Nuevo">
            Empieza un proyecto en blanco (te pide confirmación porque borra lo actual).
          </Item>
          <Item icon={<Glyph>📂</Glyph>} title="Abrir">
            Carga un proyecto guardado antes (archivo <code>.json</code>).
          </Item>
          <Item icon={<Glyph>💾</Glyph>} title="Guardar">
            Descarga tu proyecto como <code>.json</code> para seguirlo después o pasarlo a otra compu.
          </Item>
          <Item icon={<Glyph>🖼️</Glyph>} title="Importar">
            Convierte una imagen común en pixel art dentro del cuadro actual.
          </Item>
          <Item icon={<Glyph>💿</Glyph>} title="Autoguardado">
            Tu trabajo se guarda solo en el navegador, así que si recargás o se cierra la pestaña no lo perdés.
            (La imagen de referencia no se autoguarda; usá Guardar para conservar todo.)
          </Item>

          <h3>8 · Exportar</h3>
          <Item icon={<Glyph>🎬</Glyph>} title="Formatos">
            <b>Frame PNG</b> (cuadro actual), <b>GIF</b> animado, <b>Video MP4</b>, o <b>secuencias</b> PNG/JPG en un ZIP.
          </Item>
          <Item icon={<Glyph>▦</Glyph>} title="Incluir grilla">
            Si lo marcás, la exportación sale con la cuadrícula dibujada encima.
          </Item>

          <h3>9 · Mover capa</h3>
          <Item icon={<Glyph>✛</Glyph>} title="Mover capa">
            Las flechas de "Mover capa" desplazan todo el dibujo del cuadro un casillero en cualquier dirección.
          </Item>

          <h3>10 · Imagen de referencia</h3>
          <Item icon={<Glyph>🖼️</Glyph>} title="Calcar una imagen">
            Subí una foto para usarla de guía debajo del dibujo. Podés ajustar su opacidad, zoom y giro. No se exporta.
          </Item>

          <p className="help-footer">¡Listo! Cualquier duda, volvé a abrir esta ayuda cuando quieras. 🎵</p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;

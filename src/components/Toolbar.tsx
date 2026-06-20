import React, { useRef, useState } from 'react';

interface ToolbarProps {
  currentTool: string;
  setTool: (tool: 'brush' | 'eraser' | 'fill' | 'eyedropper') => void;
  currentColor: string;
  setColor: (color: string) => void;
  setCanvasBgColor: (color: string) => void;
}

interface SwatchProps {
  color: string;
  selected: boolean;
  onSelect: () => void;
  onLongPress?: () => void;
  longPressMs?: number;
  className?: string;
}

export const Swatch: React.FC<SwatchProps> = ({
  color, selected, onSelect, onLongPress, longPressMs = 3000, className,
}) => {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const [holding, setHolding] = useState(false);

  const cancel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
  };

  return (
    <div
      className={`palette-color ${selected ? 'selected' : ''} ${holding ? 'holding' : ''} ${className || ''}`}
      style={{ backgroundColor: color, ['--hold-ms' as any]: `${longPressMs}ms` }}
      title={color}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        firedRef.current = false;
        if (onLongPress) {
          setHolding(true);
          timerRef.current = window.setTimeout(() => {
            firedRef.current = true;
            setHolding(false);
            onLongPress();
          }, longPressMs);
        }
      }}
      onPointerUp={(e) => {
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        cancel();
        if (!firedRef.current) onSelect();
      }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    />
  );
};

// Paleta DB32 (DawnBringer 32) - Un estándar en Pixel Art
export const DB32_PALETTE = [
  '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
  '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
  '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
  '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30'
];

export const EXTRA_COLORS = [
  '#ff0040', '#131313', '#1b1b1b', '#272727', '#3d3d3d', '#5d5d5d', '#858585', '#b4b4b4',
  '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#8b4513', '#4b0082'
];

const Toolbar: React.FC<ToolbarProps> = ({ currentTool, setTool, currentColor, setColor, setCanvasBgColor }) => {
  return (
    <div className="toolbar">
      <div className="tool-section">
        <h3>Herramientas</h3>
        <div className="button-group">
          <button
            className={currentTool === 'brush' ? 'active' : ''}
            onClick={() => setTool('brush')}
            title="Pincel (B)"
          >
            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
              <path d="M497.9 142.1l-46.1 46.1c-4.7 4.7-12.3 4.7-17 0l-111-111c-4.7-4.7-4.7-12.3 0-17l46.1-46.1c18.7-18.7 49.1-18.7 67.9 0l60.1 60.1c18.8 18.7 18.8 49.1 0 67.9zM284.2 99.8L21.6 362.4.4 483.9c-2.9 16.4 11.4 30.6 27.8 27.8l121.5-21.3 262.6-262.6c4.7-4.7 4.7-12.3 0-17l-111-111c-4.8-4.7-12.4-4.7-17.1 0zM124.1 339.9c-5.5-5.5-5.5-14.3 0-19.8l154-154c5.5-5.5 14.3-5.5 19.8 0s5.5 14.3 0 19.8l-154 154c-5.5 5.5-14.3 5.5-19.8 0zM88 424h48v36.3l-64.5 11.3-31.1-31.1L51.7 376H88v48z"/>
            </svg>
          </button>
          <button
            className={currentTool === 'eraser' ? 'active' : ''}
            onClick={() => setTool('eraser')}
            title="Goma (E)"
          >
            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
              <path d="M497.941 273.941c18.745-18.745 18.745-49.137 0-67.882l-160-160c-18.745-18.745-49.136-18.746-67.883 0l-256 256c-18.745 18.745-18.745 49.137 0 67.882l96 96A48.004 48.004 0 0 0 144 480h356c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12H355.883l142.058-142.059zm-302.627-62.627l137.373 137.373L265.373 416H150.628l-80-80 124.686-124.686z"/>
            </svg>
          </button>
          <button
            className={currentTool === 'fill' ? 'active' : ''}
            onClick={() => setTool('fill')}
            title="Relleno (F)"
          >
            <svg width="18" height="18" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
              <path d="M512 320s-64 92.65-64 128c0 35.35 28.66 64 64 64s64-28.65 64-64-64-128-64-128zm-9.37-79.43L294.74 32.71c-12.5-12.5-32.76-12.5-45.26 0l-78.06 78.07-72.41-72.41-22.62 22.62 72.41 72.41L17.37 263.43c-12.5 12.5-12.5 32.76 0 45.26l190.86 190.86c12.5 12.5 32.76 12.5 45.26 0l249.14-249.14c12.5-12.51 12.5-32.76 0-45.26zM437.94 256H80l178.97-178.97L437.94 256z"/>
            </svg>
          </button>
          <button
            className={currentTool === 'eyedropper' ? 'active' : ''}
            onClick={() => setTool('eyedropper')}
            title="Gotero (Alt+Click)"
          >
            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
              <path d="M50.75 333.25c-12 12-18.75 28.28-18.75 45.26V424L0 480l32 32 56-32h45.49c16.97 0 33.25-6.74 45.25-18.74l129.32-129.32-128-128L50.75 333.25zM483.88 28.12c-37.47-37.5-98.28-37.5-135.75 0l-77.09 77.09-13.1-13.1c-9.44-9.44-24.65-9.31-33.94 0l-40.97 40.97c-9.37 9.37-9.37 24.57 0 33.94l161.94 161.94c9.44 9.44 24.65 9.31 33.94 0L419.88 288c9.37-9.37 9.37-24.57 0-33.94l-13.1-13.1 77.09-77.09c37.51-37.48 37.51-98.28.01-135.75z"/>
            </svg>
          </button>
        </div>

      </div>

      <div className="tool-section">
        <h3>Color Actual</h3>
        <input 
          type="color" 
          value={currentColor} 
          onChange={(e) => setColor(e.target.value)} 
          className="color-picker"
        />
        
        <h3>Paleta DB32</h3>
        <div className="palette">
          {DB32_PALETTE.map(color => (
            <Swatch
              key={color}
              color={color}
              selected={currentColor.toLowerCase() === color.toLowerCase()}
              onSelect={() => setColor(color)}
              onLongPress={() => setCanvasBgColor(color)}
            />
          ))}
        </div>

        <h3 style={{ marginTop: '15px' }}>Extras</h3>
        <div className="palette">
          {EXTRA_COLORS.map(color => (
            <Swatch
              key={color}
              color={color}
              selected={currentColor.toLowerCase() === color.toLowerCase()}
              onSelect={() => setColor(color)}
              onLongPress={() => setCanvasBgColor(color)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;

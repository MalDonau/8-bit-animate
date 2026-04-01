import React from 'react';

interface ToolbarProps {
  currentTool: string;
  setTool: (tool: 'brush' | 'eraser' | 'fill' | 'eyedropper') => void;
  currentColor: string;
  setColor: (color: string) => void;
}

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

const Toolbar: React.FC<ToolbarProps> = ({ currentTool, setTool, currentColor, setColor }) => {
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
            🖌️
          </button>
          <button 
            className={currentTool === 'eraser' ? 'active' : ''} 
            onClick={() => setTool('eraser')}
            title="Goma (E)"
          >
            🧽
          </button>
          <button 
            className={currentTool === 'fill' ? 'active' : ''} 
            onClick={() => setTool('fill')}
            title="Relleno (F)"
          >
            🧺
          </button>
          <button 
            className={currentTool === 'eyedropper' ? 'active' : ''} 
            onClick={() => setTool('eyedropper')}
            title="Cuentagotas (I)"
          >
            💉
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
            <div 
              key={color} 
              className={`palette-color ${currentColor.toLowerCase() === color.toLowerCase() ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setColor(color)}
              title={color}
            />
          ))}
        </div>

        <h3 style={{ marginTop: '15px' }}>Extras</h3>
        <div className="palette">
          {EXTRA_COLORS.map(color => (
            <div 
              key={color} 
              className={`palette-color ${currentColor.toLowerCase() === color.toLowerCase() ? 'selected' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setColor(color)}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;

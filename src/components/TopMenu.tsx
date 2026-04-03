import React from 'react';

interface TopMenuProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onOpen: () => void;
  onExport: (format: 'png' | 'gif' | 'png-seq' | 'jpg-seq') => void;
  onNew: () => void;
  onImport: () => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  isFullscreen: boolean;
  setIsFullscreen: (full: boolean) => void;
}

const TopMenu: React.FC<TopMenuProps> = ({
  onUndo, onRedo, canUndo, canRedo, 
  onSave, onOpen, onExport, onNew, onImport,
  showGrid, setShowGrid, zoom, setZoom,
  darkMode, setDarkMode,
  audioEnabled, setAudioEnabled,
  isFullscreen, setIsFullscreen
}) => {
  const [showExportMenu, setShowExportMenu] = React.useState(false);

  return (
    <div className="top-menu">
      <div className="menu-group">
        <button onClick={onNew}>Nuevo</button>
        <button onClick={onOpen}>Abrir</button>
        <button onClick={onImport}>Importar</button>
        <button onClick={onSave}>Guardar</button>
        
        <div className="export-dropdown">
          <button onClick={() => setShowExportMenu(!showExportMenu)}>
            Exportar ▾
          </button>
          {showExportMenu && (
            <div className="dropdown-content">
              <button onClick={() => { onExport('gif'); setShowExportMenu(false); }}>GIF Animado</button>
              <button onClick={() => { onExport('png-seq'); setShowExportMenu(false); }}>Secuencia PNG (ZIP)</button>
              <button onClick={() => { onExport('jpg-seq'); setShowExportMenu(false); }}>Secuencia JPG (ZIP)</button>
              <button onClick={() => { onExport('png'); setShowExportMenu(false); }}>Frame Actual PNG</button>
            </div>
          )}
        </div>
      </div>

      <div className="menu-group">
        <button onClick={onUndo} disabled={!canUndo}>Undo</button>
        <button onClick={onRedo} disabled={!canRedo}>Redo</button>
      </div>

      <div className="menu-group">
        <label>
          <input 
            type="checkbox" 
            checked={showGrid} 
            onChange={(e) => setShowGrid(e.target.checked)} 
          />
          Grilla
        </label>
        <div className="zoom-controls">
          <span>Zoom: {zoom}x</span>
          <button onClick={() => setZoom(Math.max(1, zoom - 1))}>-</button>
          <button onClick={() => setZoom(Math.min(50, zoom + 1))}>+</button>
        </div>
        
        <button 
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={audioEnabled ? 'active' : ''}
          title={audioEnabled ? "Desactivar Audio" : "Activar Audio"}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>

        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="theme-toggle"
          title={darkMode ? "Modo Claro" : "Modo Oscuro"}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>

        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="fullscreen-toggle"
          title="Pantalla Completa"
        >
          {isFullscreen ? '⏹️' : '🔳'}
        </button>
      </div>
    </div>
  );
};

export default TopMenu;

import React from 'react';

interface TopMenuProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onOpen: () => void;
  onExport: (format: 'png' | 'gif' | 'mp4' | 'png-seq' | 'jpg-seq') => void;
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
              <button onClick={() => { onExport('mp4'); setShowExportMenu(false); }}>Video MP4 (6s Loop)</button>
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
          {audioEnabled ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          )}
        </button>

        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="theme-toggle"
          title={darkMode ? "Modo Claro" : "Modo Oscuro"}
        >
          {darkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
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

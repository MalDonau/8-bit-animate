import React from 'react';

interface TimelineProps {
  frames: string[][];
  currentFrameIndex: number;
  setCurrentFrameIndex: (index: number) => void;
  addFrame: () => void;
  removeFrame: () => void;
  duplicateFrame: () => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  fps: number;
  setFps: (fps: number) => void;
  width: number;
  height: number;
  onionSkin: number;
  setOnionSkin: (count: number) => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  frames,
  currentFrameIndex,
  setCurrentFrameIndex,
  addFrame,
  removeFrame,
  duplicateFrame,
  isPlaying,
  setIsPlaying,
  fps,
  setFps,
  width,
  height,
  onionSkin,
  setOnionSkin,
  isRecording,
  setIsRecording
}) => {
  const toggleOnionSkin = () => {
    // Re-added 4 for the requested delay logic
    const sequence = [0, 1, 2, 3, 4];
    const currentIndex = sequence.indexOf(onionSkin);
    const nextIndex = (currentIndex + 1) % sequence.length;
    setOnionSkin(sequence[nextIndex]);
  };

  return (
    <div className="timeline-container">
      <div className="playback-controls">
        <div className="main-playback">
          <button 
            onClick={toggleOnionSkin} 
            className={`onion-button ${onionSkin > 0 ? 'active' : ''}`}
            title="Papel Cebolla"
          >
            🧅{onionSkin > 0 ? onionSkin : ''}
          </button>
          <button 
            className={`play-button ${isPlaying ? 'active' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button 
            className={`rec-button ${isRecording ? 'active' : ''}`}
            onClick={() => {
              if (!isPlaying) setIsPlaying(true);
              setIsRecording(!isRecording);
            }}
            title="Grabación en tiempo real"
          >
            🔴
          </button>
        </div>
        <div className="fps-control">
          <span>{fps} FPS</span>
          <input 
            type="range" 
            min="1" 
            max="30" 
            value={fps} 
            onChange={(e) => setFps(parseInt(e.target.value))} 
          />
        </div>
      </div>

      <div className="frames-list">
        {frames.map((frame, index) => (
          <div 
            key={index}
            className={`frame-thumbnail ${index === currentFrameIndex ? 'selected' : ''}`}
            onClick={() => setCurrentFrameIndex(index)}
          >
            <div className="frame-number">{index + 1}</div>
            <MiniCanvas pixels={frame} width={width} height={height} />
          </div>
        ))}
        {frames.length < 48 && (
          <button className="add-frame-btn" onClick={addFrame}>+</button>
        )}
      </div>

      <div className="frame-actions">
        <button onClick={duplicateFrame} title="Duplicar Frame">👯</button>
        <button onClick={removeFrame} title="Eliminar Frame" disabled={frames.length <= 1}>🗑️</button>
      </div>
    </div>
  );
};

const MiniCanvas: React.FC<{ pixels: string[], width: number, height: number }> = ({ pixels, width, height }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    pixels.forEach((color, index) => {
      if (color === 'transparent') return;
      ctx.fillStyle = color;
      ctx.fillRect(index % width, Math.floor(index / width), 1, 1);
    });
  }, [pixels, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="mini-canvas" />;
};

export default Timeline;

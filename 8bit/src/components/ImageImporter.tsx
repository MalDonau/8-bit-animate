import React, { useState, useRef, useEffect } from 'react';

interface ImageImporterProps {
  onImport: (pixels: string[]) => void;
  onCancel: () => void;
  width: number;
  height: number;
  palette: string[];
}

const ImageImporter: React.FC<ImageImporterProps> = ({ onImport, onCancel, width, height, palette }) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Corrected file handler
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        const s = Math.min(width / img.width, height / img.height);
        setScale(s);
        setOffsetX((width - img.width * s) / 2);
        setOffsetY((height - img.height * s) / 2);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#eee';
    ctx.fillRect(0, 0, width, height);
    
    // Draw image with current scale/offset
    ctx.drawImage(
      image,
      offsetX, offsetY,
      image.width * scale,
      image.height * scale
    );
  }, [image, scale, offsetX, offsetY, width, height]);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const getNearestColor = (r: number, g: number, b: number) => {
    let minDistance = Infinity;
    let nearestColor = palette[0];

    palette.forEach(color => {
      const rgb = hexToRgb(color);
      const distance = Math.sqrt(
        Math.pow(r - rgb.r, 2) +
        Math.pow(g - rgb.g, 2) +
        Math.pow(b - rgb.b, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestColor = color;
      }
    });

    return nearestColor;
  };

  const processImport = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels: string[] = [];

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      if (a < 128) {
        pixels.push('transparent');
      } else {
        pixels.push(getNearestColor(r, g, b));
      }
    }

    onImport(pixels);
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !image) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!image) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.01, Math.min(20, scale * factor));
    setScale(newScale);
  };

  return (
    <div className="importer-overlay">
      <div className="importer-modal">
        <h3>Importar Imagen</h3>
        {!image ? (
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        ) : (
          <>
            <div className="preview-container">
              <canvas 
                ref={canvasRef} 
                width={width} 
                height={height} 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{ 
                  width: width * 10, 
                  height: height * 10, 
                  imageRendering: 'pixelated',
                  border: '1px solid #ccc',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }} 
              />
            </div>
            <div className="controls">
              <label>Zoom: 
                <input type="range" min="0.01" max="10" step="0.01" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} />
              </label>
              <label>X: 
                <input type="range" min={-width} max={width} step="1" value={offsetX} onChange={(e) => setOffsetX(parseFloat(e.target.value))} />
              </label>
              <label>Y: 
                <input type="range" min={-height} max={height} step="1" value={offsetY} onChange={(e) => setOffsetY(parseFloat(e.target.value))} />
              </label>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button onClick={onCancel}>Cancelar</button>
          <button onClick={processImport} disabled={!image} className="active">Aceptar e Interpretar</button>
        </div>
      </div>
    </div>
  );
};

export default ImageImporter;

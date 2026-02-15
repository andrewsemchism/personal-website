'use client';

import { useRef, useState, useEffect, MouseEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPaintBrush, faEraser, faTrash } from '@fortawesome/free-solid-svg-icons';

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'marker' | 'fatMarker' | 'eraser' | 'fatEraser'>('marker');
  const [markerColor, setMarkerColor] = useState<'#000000' | '#FF0000' | '#0000FF'>('#000000');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Handle window resize
    const handleResize = () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'marker') {
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 3;
    } else if (tool === 'fatMarker') {
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 10;
    } else if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 15;
    } else if (tool === 'fatEraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 120;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-4">
        {/* Tool buttons */}
        <div className="flex gap-2">
        <button
          onClick={() => setTool('marker')}
          aria-label="Marker"
          title="Marker"
          className={`px-4 py-2 rounded font-sans ${
            tool === 'marker'
              ? 'bg-black text-white'
              : 'bg-gray-200 text-black hover:bg-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faPen} />
        </button>
        <button
          onClick={() => setTool('fatMarker')}
          aria-label="Fat Marker"
          title="Fat Marker"
          className={`px-4 py-2 rounded font-sans ${
            tool === 'fatMarker'
              ? 'bg-black text-white'
              : 'bg-gray-200 text-black hover:bg-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faPaintBrush} />
        </button>
        <button
          onClick={() => setTool('eraser')}
          aria-label="Eraser"
          title="Eraser"
          className={`px-4 py-2 rounded font-sans ${
            tool === 'eraser'
              ? 'bg-black text-white'
              : 'bg-gray-200 text-black hover:bg-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faEraser} />
        </button>
        <button
          onClick={() => setTool('fatEraser')}
          aria-label="Fat Eraser"
          title="Fat Eraser"
          className={`px-4 py-2 rounded font-sans ${
            tool === 'fatEraser'
              ? 'bg-black text-white'
              : 'bg-gray-200 text-black hover:bg-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faEraser} size="lg" />
        </button>
        <button
          onClick={clearCanvas}
          aria-label="Clear"
          title="Clear"
          className="px-4 py-2 rounded font-sans bg-red-500 text-white hover:bg-red-600"
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
        </div>

        {/* Color selector */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setMarkerColor('#000000')}
            aria-label="Black"
            title="Black"
            className={`w-10 h-10 rounded transition-all ${
              markerColor === '#000000'
                ? 'border-4 border-white shadow-xl scale-125 ring-4 ring-white/50'
                : 'border-2 border-gray-400 opacity-50 hover:opacity-75'
            }`}
            style={{ backgroundColor: '#000000' }}
          />
          <button
            onClick={() => setMarkerColor('#FF0000')}
            aria-label="Red"
            title="Red"
            className={`w-10 h-10 rounded transition-all ${
              markerColor === '#FF0000'
                ? 'border-4 border-white shadow-xl scale-125 ring-4 ring-white/50'
                : 'border-2 border-gray-400 opacity-50 hover:opacity-75'
            }`}
            style={{ backgroundColor: '#FF0000' }}
          />
          <button
            onClick={() => setMarkerColor('#0000FF')}
            aria-label="Blue"
            title="Blue"
            className={`w-10 h-10 rounded transition-all ${
              markerColor === '#0000FF'
                ? 'border-4 border-white shadow-xl scale-125 ring-4 ring-white/50'
                : 'border-2 border-gray-400 opacity-50 hover:opacity-75'
            }`}
            style={{ backgroundColor: '#0000FF' }}
          />
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="cursor-crosshair"
      />
    </div>
  );
}

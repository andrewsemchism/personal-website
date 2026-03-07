'use client';

import { useRef, useState, useEffect, MouseEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPaintBrush, faEraser, faTrash } from '@fortawesome/free-solid-svg-icons';

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'marker' | 'fatMarker' | 'eraser' | 'fatEraser'>('marker');
  const [markerColor, setMarkerColor] = useState<'#000000' | '#FF0000' | '#0000FF'>('#000000');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const lastDrawingTool = useRef<'marker' | 'fatMarker'>('marker');

  // Refs so touch handlers (added via addEventListener) always see current values
  const isDrawingRef = useRef(false);
  const toolRef = useRef(tool);
  const markerColorRef = useRef(markerColor);

  useEffect(() => {
    toolRef.current = tool;
    if (tool === 'marker' || tool === 'fatMarker') lastDrawingTool.current = tool;
  }, [tool]);
  useEffect(() => { markerColorRef.current = markerColor; }, [markerColor]);

  const applyToolStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const t = toolRef.current;
    const c = markerColorRef.current;
    if (t === 'marker')         { ctx.strokeStyle = c;         ctx.lineWidth = 3; }
    else if (t === 'fatMarker') { ctx.strokeStyle = c;         ctx.lineWidth = 10; }
    else if (t === 'eraser')    { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 15; }
    else if (t === 'fatEraser') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 120; }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const handleResize = () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
    };

    const getPos = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e.touches[0]);
      isDrawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e.touches[0]);
      applyToolStyle(ctx);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleTouchEnd = () => {
      isDrawingRef.current = false;
      setIsDrawing(false);
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursorPos({ x, y });
    if (!isDrawing) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    applyToolStyle(ctx);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    setIsDrawing(false);
    setCursorPos(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const toolBtn = (active: boolean) =>
    `w-9 h-9 flex items-center justify-center rounded-full text-sm transition-all ${
      active ? 'bg-gray-800 text-white shadow-inner' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Floating bottom toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-2 bg-white rounded-full shadow-2xl border border-gray-100">
        <button onClick={() => { setTool('marker'); lastDrawingTool.current = 'marker'; }} aria-label="Marker" title="Marker" className={toolBtn(tool === 'marker')}>
          <FontAwesomeIcon icon={faPen} />
        </button>
        <button onClick={() => { setTool('fatMarker'); lastDrawingTool.current = 'fatMarker'; }} aria-label="Fat Marker" title="Fat Marker" className={toolBtn(tool === 'fatMarker')}>
          <FontAwesomeIcon icon={faPaintBrush} />
        </button>
        <button onClick={() => setTool('eraser')} aria-label="Eraser" title="Eraser" className={toolBtn(tool === 'eraser')}>
          <FontAwesomeIcon icon={faEraser} />
        </button>
        <button onClick={() => setTool('fatEraser')} aria-label="Fat Eraser" title="Fat Eraser" className={toolBtn(tool === 'fatEraser')}>
          <FontAwesomeIcon icon={faEraser} size="lg" />
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        {(['#000000', '#FF0000', '#0000FF'] as const).map((color) => (
          <button
            key={color}
            onClick={() => { setMarkerColor(color); setTool(lastDrawingTool.current); }}
            aria-label={color === '#000000' ? 'Black' : color === '#FF0000' ? 'Red' : 'Blue'}
            className={`w-7 h-7 mx-1 rounded-full transition-all ${
              markerColor === color
                ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                : 'opacity-60 hover:opacity-90'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <button onClick={clearCanvas} aria-label="Clear" title="Clear" className="w-9 h-9 flex items-center justify-center rounded-full text-sm text-red-500 hover:bg-red-50 transition-all">
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className={tool === 'eraser' || tool === 'fatEraser' ? 'cursor-none' : 'cursor-crosshair'}
      />

      {cursorPos && (tool === 'eraser' || tool === 'fatEraser') && (
        <div
          className="absolute rounded-full border-2 border-gray-400 pointer-events-none"
          style={{
            width:  tool === 'fatEraser' ? 120 : 15,
            height: tool === 'fatEraser' ? 120 : 15,
            left: cursorPos.x,
            top: cursorPos.y,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  );
}

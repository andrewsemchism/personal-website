'use client';

import { useRef, useState, useEffect, MouseEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPaintBrush, faEraser, faTrash, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

type Tool = 'marker' | 'fatMarker' | 'eraser' | 'fatEraser';
type Color = '#000000' | '#FF0000' | '#0000FF';
type HandleType = 'move' | 'tl' | 'tr' | 'bl' | 'br';

interface PastedImage {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  type: HandleType;
  startMouseX: number;
  startMouseY: number;
  startImg: PastedImage;
}

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('marker');
  const [markerColor, setMarkerColor] = useState<Color>('#000000');
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pastedImage, setPastedImage] = useState<PastedImage | null>(null);

  const lastDrawingTool = useRef<'marker' | 'fatMarker'>('marker');
  const isDrawingRef = useRef(false);
  const toolRef = useRef<Tool>(tool);
  const markerColorRef = useRef<Color>(markerColor);
  const imageDragRef = useRef<DragState | null>(null);

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

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            const maxW = canvas.width * 0.8;
            const maxH = canvas.height * 0.8;
            let w = img.width;
            let h = img.height;
            if (w > maxW) { h = (h * maxW) / w; w = maxW; }
            if (h > maxH) { w = (w * maxH) / h; h = maxH; }
            setPastedImage({
              src: url,
              x: (canvas.width - w) / 2,
              y: (canvas.height - h) / 2,
              width: w,
              height: h,
            });
          };
          img.src = url;
          break;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('paste', handlePaste);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('paste', handlePaste);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    if (pastedImage) return;
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
    if (pastedImage) return;
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

  const commitImage = () => {
    if (!pastedImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, pastedImage.x, pastedImage.y, pastedImage.width, pastedImage.height);
      URL.revokeObjectURL(pastedImage.src);
      setPastedImage(null);
    };
    img.src = pastedImage.src;
  };

  const cancelImage = () => {
    if (!pastedImage) return;
    URL.revokeObjectURL(pastedImage.src);
    setPastedImage(null);
  };

  const startImageDrag = (e: MouseEvent, type: HandleType) => {
    e.stopPropagation();
    e.preventDefault();
    if (!pastedImage) return;
    imageDragRef.current = {
      type,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startImg: { ...pastedImage },
    };
  };

  const handleGlobalMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const drag = imageDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startMouseX;
    const dy = e.clientY - drag.startMouseY;
    const { x, y, width, height } = drag.startImg;
    const min = 40;

    const aspect = width / height;

    setPastedImage(prev => {
      if (!prev) return prev;
      if (drag.type === 'move') return { ...prev, x: x + dx, y: y + dy };
      if (drag.type === 'br') {
        const w = Math.max(min, width + dx);
        return { ...prev, width: w, height: w / aspect };
      }
      if (drag.type === 'bl') {
        const w = Math.max(min, width - dx);
        return { ...prev, x: x + width - w, width: w, height: w / aspect };
      }
      if (drag.type === 'tr') {
        const w = Math.max(min, width + dx);
        const h = w / aspect;
        return { ...prev, y: y + height - h, width: w, height: h };
      }
      if (drag.type === 'tl') {
        const w = Math.max(min, width - dx);
        const h = w / aspect;
        return { ...prev, x: x + width - w, y: y + height - h, width: w, height: h };
      }
      return prev;
    });
  };

  const handleGlobalMouseUp = () => {
    imageDragRef.current = null;
  };

  const isEraser = tool === 'eraser' || tool === 'fatEraser';

  const toolBtn = (active: boolean) =>
    `w-9 h-9 flex items-center justify-center rounded-full text-sm transition-all ${
      active ? 'bg-gray-800 text-white shadow-inner' : 'text-gray-600 hover:bg-gray-100'
    }`;

  const handles: { type: HandleType; style: React.CSSProperties }[] = [
    { type: 'tl', style: { top: -5,  left: -5,  cursor: 'nwse-resize' } },
    { type: 'tr', style: { top: -5,  right: -5, cursor: 'nesw-resize' } },
    { type: 'bl', style: { bottom: -5, left: -5,  cursor: 'nesw-resize' } },
    { type: 'br', style: { bottom: -5, right: -5, cursor: 'nwse-resize' } },
  ];

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      onMouseMove={handleGlobalMouseMove}
      onMouseUp={handleGlobalMouseUp}
    >
      {/* Floating bottom toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-3 py-2 bg-white rounded-full shadow-2xl border border-gray-100">
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

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className={isEraser && !pastedImage ? 'cursor-none' : 'cursor-crosshair'}
      />

      {/* Eraser cursor circle */}
      {cursorPos && isEraser && !pastedImage && (
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

      {/* Pasted image overlay */}
      {pastedImage && (
        <div
          className="absolute"
          style={{
            left: pastedImage.x,
            top: pastedImage.y,
            width: pastedImage.width,
            height: pastedImage.height,
            zIndex: 20,
            cursor: 'move',
            outline: '2px dashed #6b7280',
            outlineOffset: '1px',
          }}
          onMouseDown={(e) => startImageDrag(e, 'move')}
        >
          <img
            src={pastedImage.src}
            alt="pasted"
            draggable={false}
            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
          />

          {/* Corner resize handles */}
          {handles.map(({ type, style }) => (
            <div
              key={type}
              className="absolute w-3 h-3 bg-white border-2 border-gray-500 rounded-sm"
              style={{ ...style, zIndex: 21 }}
              onMouseDown={(e) => startImageDrag(e, type)}
            />
          ))}

          {/* Commit / cancel */}
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={commitImage}
              className="w-7 h-7 flex items-center justify-center bg-green-500 text-white rounded-full shadow hover:bg-green-600 text-xs"
              title="Stamp to canvas"
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={cancelImage}
              className="w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full shadow hover:bg-red-600 text-xs"
              title="Cancel"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

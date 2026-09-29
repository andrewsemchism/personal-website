'use client';

import { useRef, useState, useEffect, MouseEvent, PointerEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPaintBrush, faEraser, faTrash, faCheck, faXmark, faRotateLeft, faRotateRight, faFont, faMinus, faPlus, faUpDownLeftRight } from '@fortawesome/free-solid-svg-icons';

type Tool = 'marker' | 'fatMarker' | 'eraser' | 'fatEraser' | 'text';
type Color = '#000000' | '#FF0000' | '#0000FF';
type HandleType = 'move' | 'tl' | 'tr' | 'bl' | 'br';

interface PastedImage {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_HISTORY = 50;

const TEXT_FONT = 'Arial, Helvetica, sans-serif';
const TEXT_LINE_HEIGHT = 1.2;
const TEXT_PAD = 6;
const TEXT_CONTROLS_WIDTH = 318;
const TEXT_SIZES = [12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160];

interface TextBox {
  id: number;
  x: number;
  y: number;
  text: string;
}

interface TextDragState {
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
const measureLines = (lines: string[], size: number) => {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  measureCtx.font = `${size}px ${TEXT_FONT}`;
  return Math.max(0, ...lines.map((l) => measureCtx!.measureText(l).width));
};

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
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const pendingSnapshotRef = useRef<ImageData | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [textBox, setTextBox] = useState<TextBox | null>(null);
  const [textSize, setTextSize] = useState(32);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const textDragRef = useRef<TextDragState | null>(null);
  const placeTextRef = useRef<(x: number, y: number) => void>(() => {});

  useEffect(() => {
    toolRef.current = tool;
    if (tool === 'marker' || tool === 'fatMarker') lastDrawingTool.current = tool;
  }, [tool]);

  useEffect(() => { markerColorRef.current = markerColor; }, [markerColor]);

  const syncHistoryState = () => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const takeSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  };

  const pushHistory = (snapshot: ImageData | null = takeSnapshot()) => {
    if (!snapshot) return;
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    redoStackRef.current = [];
    syncHistoryState();
  };

  // Strokes only become an undo step once they actually draw something
  const beginStroke = () => { pendingSnapshotRef.current = takeSnapshot(); };
  const flushPendingSnapshot = () => {
    if (!pendingSnapshotRef.current) return;
    pushHistory(pendingSnapshotRef.current);
    pendingSnapshotRef.current = null;
  };

  const restoreSnapshot = (snapshot: ImageData) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(snapshot, 0, 0);
  };

  const undo = () => {
    const prev = undoStackRef.current.pop();
    const current = takeSnapshot();
    if (!prev || !current) return;
    redoStackRef.current.push(current);
    restoreSnapshot(prev);
    syncHistoryState();
  };

  const redo = () => {
    const next = redoStackRef.current.pop();
    const current = takeSnapshot();
    if (!next || !current) return;
    undoStackRef.current.push(current);
    restoreSnapshot(next);
    syncHistoryState();
  };

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
      if (toolRef.current === 'text') { placeTextRef.current(x, y); return; }
      isDrawingRef.current = true;
      beginStroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDrawingRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e.touches[0]);
      flushPendingSnapshot();
      applyToolStyle(ctx);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleTouchEnd = () => {
      isDrawingRef.current = false;
      pendingSnapshotRef.current = null;
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      // Let the text box keep its own native undo while typing
      if (e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo(); }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    if (pastedImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (tool === 'text') {
      // Keep focus from leaving the new text box
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      placeText(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    setIsDrawing(true);
    beginStroke();
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
    flushPendingSnapshot();
    applyToolStyle(ctx);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    pendingSnapshotRef.current = null;
    setIsDrawing(false);
    setCursorPos(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    pushHistory();
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
      pushHistory();
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

  const drawTextToCanvas = (box: TextBox) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    pushHistory();
    ctx.font = `${textSize}px ${TEXT_FONT}`;
    ctx.fillStyle = markerColor;
    ctx.textBaseline = 'alphabetic';
    // Match the textarea's CSS line box so the text lands exactly where it was typed
    const m = ctx.measureText('Hg');
    const ascent = m.fontBoundingBoxAscent;
    const lineH = textSize * TEXT_LINE_HEIGHT;
    const halfLeading = (lineH - (ascent + m.fontBoundingBoxDescent)) / 2;
    box.text.split('\n').forEach((line, i) => {
      ctx.fillText(line, box.x + TEXT_PAD, box.y + TEXT_PAD + i * lineH + halfLeading + ascent);
    });
  };

  const commitText = () => {
    if (!textBox) return;
    if (textBox.text.trim()) drawTextToCanvas(textBox);
    setTextBox(null);
  };

  const cancelText = () => setTextBox(null);

  const placeText = (x: number, y: number) => {
    commitText();
    setTextBox({
      id: Date.now(),
      x: x - TEXT_PAD,
      y: y - TEXT_PAD - (textSize * TEXT_LINE_HEIGHT) / 2,
      text: '',
    });
  };
  useEffect(() => { placeTextRef.current = placeText; });

  const selectTool = (t: Tool) => {
    if (t !== 'text') commitText();
    setTool(t);
  };

  useEffect(() => {
    if (!textBox) return;
    const id = requestAnimationFrame(() => textAreaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [textBox?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeTextSize = (dir: 1 | -1) => {
    const idx = TEXT_SIZES.findIndex((s) => s >= textSize);
    const next = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, (idx === -1 ? TEXT_SIZES.length - 1 : idx) + dir))];
    setTextSize(next);
    textAreaRef.current?.focus();
  };

  const startTextDrag = (e: PointerEvent<HTMLElement>) => {
    if (!textBox || e.target !== e.currentTarget) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    textDragRef.current = { startMouseX: e.clientX, startMouseY: e.clientY, startX: textBox.x, startY: textBox.y };
  };

  const moveTextDrag = (e: PointerEvent<HTMLElement>) => {
    const drag = textDragRef.current;
    if (!drag) return;
    setTextBox((prev) => prev && {
      ...prev,
      x: drag.startX + e.clientX - drag.startMouseX,
      y: drag.startY + e.clientY - drag.startMouseY,
    });
  };

  const endTextDrag = () => {
    textDragRef.current = null;
    textAreaRef.current?.focus();
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

  const textLines = textBox ? textBox.text.split('\n') : [];
  const textBoxWidth = textBox ? Math.max(measureLines(textLines, textSize), textSize * 0.6) + textSize * 0.5 : 0;
  const textBoxHeight = textLines.length * textSize * TEXT_LINE_HEIGHT;
  const textActionsAbove = textBox ? textBox.y >= 72 : true;
  // Shift the controls left if they'd run off the right edge of the screen
  const textControlsLeft = textBox
    ? Math.max(8 - textBox.x, Math.min(0, window.innerWidth - 8 - TEXT_CONTROLS_WIDTH - textBox.x))
    : 0;

  const toolBtn = (active: boolean) =>
    `w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-full text-sm transition-all ${
      active ? 'bg-gray-800 text-white shadow-inner' : 'text-gray-600 hover:bg-gray-100'
    }`;

  const historyBtn =
    'w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default';

  // Keep the accept/delete buttons above the image, or below it if there's no room
  const imageActionsAbove = pastedImage ? pastedImage.y >= 72 : true;

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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center sm:gap-1 px-2 sm:px-3 py-2 max-w-[calc(100vw-16px)] overflow-x-auto bg-white rounded-full shadow-2xl border border-gray-100">
        <button onClick={() => { selectTool('marker'); lastDrawingTool.current = 'marker'; }} aria-label="Marker" title="Marker" className={toolBtn(tool === 'marker')}>
          <FontAwesomeIcon icon={faPen} />
        </button>
        <button onClick={() => { selectTool('fatMarker'); lastDrawingTool.current = 'fatMarker'; }} aria-label="Fat Marker" title="Fat Marker" className={toolBtn(tool === 'fatMarker')}>
          <FontAwesomeIcon icon={faPaintBrush} />
        </button>
        <button onClick={() => selectTool('eraser')} aria-label="Eraser" title="Eraser" className={toolBtn(tool === 'eraser')}>
          <FontAwesomeIcon icon={faEraser} />
        </button>
        <button onClick={() => selectTool('fatEraser')} aria-label="Fat Eraser" title="Fat Eraser" className={toolBtn(tool === 'fatEraser')}>
          <FontAwesomeIcon icon={faEraser} size="lg" />
        </button>
        <button onClick={() => selectTool('text')} aria-label="Text" title="Text (click the board to type)" className={toolBtn(tool === 'text')}>
          <FontAwesomeIcon icon={faFont} />
        </button>

        <div className="w-px h-6 shrink-0 bg-gray-200 mx-0.5 sm:mx-1" />

        {(['#000000', '#FF0000', '#0000FF'] as const).map((color) => (
          <button
            key={color}
            onClick={() => { setMarkerColor(color); if (tool !== 'text') selectTool(lastDrawingTool.current); }}
            aria-label={color === '#000000' ? 'Black' : color === '#FF0000' ? 'Red' : 'Blue'}
            className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 mx-0.5 sm:mx-1 rounded-full transition-all ${
              markerColor === color
                ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                : 'opacity-60 hover:opacity-90'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}

        <div className="w-px h-6 shrink-0 bg-gray-200 mx-0.5 sm:mx-1" />

        <button onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" className={historyBtn}>
          <FontAwesomeIcon icon={faRotateLeft} />
        </button>
        <button onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className={historyBtn}>
          <FontAwesomeIcon icon={faRotateRight} />
        </button>

        <div className="w-px h-6 shrink-0 bg-gray-200 mx-0.5 sm:mx-1" />

        <button onClick={clearCanvas} aria-label="Clear" title="Clear" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-full text-sm text-red-500 hover:bg-red-50 transition-all">
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
        className={pastedImage ? 'cursor-crosshair' : isEraser ? 'cursor-none' : tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}
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

      {/* Text box being edited */}
      {textBox && (
        <div className="absolute" style={{ left: textBox.x, top: textBox.y, zIndex: 25 }}>
          <div
            onPointerDown={startTextDrag}
            onPointerMove={moveTextDrag}
            onPointerUp={endTextDrag}
            style={{
              padding: TEXT_PAD,
              cursor: 'move',
              outline: '2px dashed #9ca3af',
              borderRadius: 4,
              touchAction: 'none',
            }}
          >
            <textarea
              ref={textAreaRef}
              value={textBox.text}
              onChange={(e) => setTextBox({ ...textBox, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                  e.preventDefault();
                  commitText();
                }
              }}
              placeholder="Type…"
              wrap="off"
              spellCheck={false}
              style={{
                display: 'block',
                width: textBoxWidth,
                height: textBoxHeight,
                fontFamily: TEXT_FONT,
                fontSize: textSize,
                lineHeight: TEXT_LINE_HEIGHT,
                color: markerColor,
                padding: 0,
                margin: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                resize: 'none',
                overflow: 'hidden',
                whiteSpace: 'pre',
              }}
            />
          </div>

          {/* Text controls: move, size, accept, delete */}
          <div
            className="absolute flex items-center gap-1 p-1 bg-white rounded-full shadow-lg border border-gray-100 whitespace-nowrap"
            style={{
              left: textControlsLeft,
              ...(textActionsAbove ? { bottom: '100%', marginBottom: 12 } : { top: '100%', marginTop: 12 }),
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div
              onPointerDown={startTextDrag}
              onPointerMove={moveTextDrag}
              onPointerUp={endTextDrag}
              className="w-11 h-11 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 cursor-move"
              style={{ touchAction: 'none' }}
              title="Drag to move"
            >
              <FontAwesomeIcon icon={faUpDownLeftRight} className="pointer-events-none" />
            </div>
            <div className="w-px h-6 shrink-0 bg-gray-200 mx-1" />
            <button
              onClick={() => changeTextSize(-1)}
              disabled={textSize <= TEXT_SIZES[0]}
              className="w-11 h-11 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
              aria-label="Smaller text"
              title="Smaller text"
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <span className="w-10 text-center text-sm font-semibold text-gray-700 tabular-nums">{textSize}</span>
            <button
              onClick={() => changeTextSize(1)}
              disabled={textSize >= TEXT_SIZES[TEXT_SIZES.length - 1]}
              className="w-11 h-11 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
              aria-label="Bigger text"
              title="Bigger text"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
            <div className="w-px h-6 shrink-0 bg-gray-200 mx-1" />
            <button
              onClick={commitText}
              className="w-11 h-11 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 text-lg cursor-pointer"
              aria-label="Accept text"
              title="Accept (Esc)"
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
            <button
              onClick={cancelText}
              className="w-11 h-11 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 text-lg cursor-pointer"
              aria-label="Delete text"
              title="Delete text"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>
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
          <div
            className="absolute right-0 flex gap-3"
            style={imageActionsAbove ? { bottom: '100%', marginBottom: 14 } : { top: '100%', marginTop: 14 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={commitImage}
              className="h-12 px-5 flex items-center gap-2 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 text-base font-semibold whitespace-nowrap cursor-pointer"
              aria-label="Accept image"
              title="Stamp to canvas"
            >
              <FontAwesomeIcon icon={faCheck} className="text-xl" />
              Accept
            </button>
            <button
              onClick={cancelImage}
              className="h-12 px-5 flex items-center gap-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 text-base font-semibold whitespace-nowrap cursor-pointer"
              aria-label="Delete image"
              title="Delete image"
            >
              <FontAwesomeIcon icon={faXmark} className="text-xl" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

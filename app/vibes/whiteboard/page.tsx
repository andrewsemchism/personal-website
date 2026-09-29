'use client';

import { useRef, useState, useEffect, MouseEvent, PointerEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faPaintBrush, faEraser, faTrash, faCheck, faXmark, faRotateLeft, faRotateRight, faFont, faMinus, faPlus, faUpDownLeftRight, faCopy, faScissors, faPaste, faTrashCan } from '@fortawesome/free-solid-svg-icons';

type SelectTool = 'rectSelect' | 'lassoSelect';
type Tool = 'marker' | 'fatMarker' | 'eraser' | 'fatEraser' | 'text' | SelectTool;
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

const SEL_MIN = 3;
const SEL_CONTROLS_WIDTH = 236;

interface Point {
  x: number;
  y: number;
}

interface Outline {
  d: string;
  w: number;
  h: number;
}

// A floating selection, like MS Paint's: its pixels live in their own canvas until it's committed
interface Selection {
  id: number;
  pixels: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  // Where the pixels were taken from, so they can be erased once the selection is moved
  srcX: number;
  srcY: number;
  mask: Uint8Array | null;
  lifted: boolean;
  outline: Outline | null;
}

interface SelDragState {
  type: HandleType;
  startMouseX: number;
  startMouseY: number;
  start: Selection;
}

interface Clip {
  pixels: HTMLCanvasElement;
  outline: Outline | null;
  x: number;
  y: number;
  pastes: number;
}

// Latest handlers for listeners registered once on mount
interface LiveHandlers {
  placeText: (x: number, y: number) => void;
  beginSelect: (p: Point) => void;
  updateSelect: (p: Point) => void;
  endSelect: () => void;
  keyDown: (e: KeyboardEvent) => void;
  pasteClipboard: (hasExternalImage: boolean) => boolean;
  commitSelection: () => void;
}

const isSelectTool = (t: Tool): t is SelectTool => t === 'rectSelect' || t === 'lassoSelect';

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

function SelectionPixels({ source }: { source: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = source.width;
    c.height = source.height;
    c.getContext('2d')?.drawImage(source, 0, 0);
  }, [source]);
  return <canvas ref={ref} className="pointer-events-none" style={{ display: 'block', width: '100%', height: '100%' }} />;
}

const RectSelectIcon = () => (
  <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" strokeDasharray="3.5 2.5" />
  </svg>
);

const LassoIcon = () => (
  <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <ellipse cx="13" cy="9.5" rx="8.5" ry="6" strokeDasharray="3.5 2.5" />
    <path d="M7.5 14.5c-2 1.5-2.5 4-0.5 6" />
  </svg>
);

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
  const liveRef = useRef<LiveHandlers | null>(null);
  const [selection, setSelectionState] = useState<Selection | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const selDragRef = useRef<SelDragState | null>(null);
  const [selDraft, setSelDraftState] = useState<Point[] | null>(null);
  const selDraftRef = useRef<Point[] | null>(null);
  const clipboardRef = useRef<Clip | null>(null);
  // False once the window loses focus, since the system clipboard may hold something newer
  const clipboardFreshRef = useRef(false);
  const [hasClip, setHasClip] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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
    commitSelection();
    const prev = undoStackRef.current.pop();
    const current = takeSnapshot();
    if (!prev || !current) return;
    redoStackRef.current.push(current);
    restoreSnapshot(prev);
    syncHistoryState();
  };

  const redo = () => {
    commitSelection();
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
      if (toolRef.current === 'text') { liveRef.current?.placeText(x, y); return; }
      if (isSelectTool(toolRef.current)) { liveRef.current?.beginSelect({ x, y }); return; }
      isDrawingRef.current = true;
      beginStroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (selDraftRef.current) { liveRef.current?.updateSelect(getPos(e.touches[0])); return; }
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
      if (selDraftRef.current) liveRef.current?.endSelect();
      isDrawingRef.current = false;
      pendingSnapshotRef.current = null;
      setIsDrawing(false);
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const hasExternalImage = items.some((item) => item.type.startsWith('image/'));
      if (liveRef.current?.pasteClipboard(hasExternalImage)) { e.preventDefault(); return; }
      if (hasExternalImage) liveRef.current?.commitSelection();
      for (const item of items) {
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

    const handleKeyDown = (e: KeyboardEvent) => liveRef.current?.keyDown(e);
    const handleBlur = () => { clipboardFreshRef.current = false; };

    window.addEventListener('resize', handleResize);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    if (pastedImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    commitSelection();
    if (isSelectTool(tool)) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      beginSelect({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      return;
    }
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
    commitSelection();
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
  const selectTool = (t: Tool) => {
    if (t !== 'text') commitText();
    if (t !== tool) commitSelection();
    setTool(t);
  };

  // --- Selection (rectangle + lasso), modelled on MS Paint ---

  const setSelection = (sel: Selection | null) => {
    selectionRef.current = sel;
    setSelectionState(sel);
  };

  const setSelDraft = (pts: Point[] | null) => {
    selDraftRef.current = pts;
    setSelDraftState(pts);
  };

  const clampToCanvas = (p: Point): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return p;
    return { x: Math.min(canvas.width, Math.max(0, p.x)), y: Math.min(canvas.height, Math.max(0, p.y)) };
  };

  const createSelection = (points: Point[], lasso: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const w = Math.min(canvas.width, Math.ceil(Math.max(...xs))) - x0;
    const h = Math.min(canvas.height, Math.ceil(Math.max(...ys))) - y0;
    if (w < SEL_MIN || h < SEL_MIN || (lasso && points.length < 3)) return;

    let mask: Uint8Array | null = null;
    let outline: Outline | null = null;
    if (lasso) {
      const maskCtx = makeCanvas(w, h).getContext('2d');
      if (!maskCtx) return;
      maskCtx.beginPath();
      points.forEach((p, i) => (i ? maskCtx.lineTo(p.x - x0, p.y - y0) : maskCtx.moveTo(p.x - x0, p.y - y0)));
      maskCtx.closePath();
      maskCtx.fill();
      // Hard-edged mask so moved pieces don't leave faint outlines behind
      const alpha = maskCtx.getImageData(0, 0, w, h).data;
      mask = new Uint8Array(w * h);
      for (let i = 0; i < mask.length; i++) mask[i] = alpha[i * 4 + 3] >= 128 ? 1 : 0;
      outline = { d: `M${points.map((p) => `${p.x - x0} ${p.y - y0}`).join('L')}Z`, w, h };
    }

    const data = ctx.getImageData(x0, y0, w, h);
    if (mask) for (let i = 0; i < mask.length; i++) if (!mask[i]) data.data[i * 4 + 3] = 0;
    const pixels = makeCanvas(w, h);
    pixels.getContext('2d')?.putImageData(data, 0, 0);
    setSelection({ id: Date.now(), pixels, x: x0, y: y0, w, h, srcX: x0, srcY: y0, mask, lifted: false, outline });
  };

  const beginSelect = (p: Point) => {
    commitSelection();
    setSelDraft([clampToCanvas(p)]);
  };

  const updateSelect = (raw: Point) => {
    const pts = selDraftRef.current;
    if (!pts) return;
    const p = clampToCanvas(raw);
    if (tool === 'lassoSelect') {
      const last = pts[pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) setSelDraft([...pts, p]);
    } else {
      setSelDraft([pts[0], p]);
    }
  };

  const endSelect = () => {
    const pts = selDraftRef.current;
    setSelDraft(null);
    if (pts) createSelection(pts, tool === 'lassoSelect');
  };

  // Fill the selection's original spot with white
  const eraseSource = (sel: Selection) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { width, height } = sel.pixels;
    if (!sel.mask) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sel.srcX, sel.srcY, width, height);
      return;
    }
    const data = ctx.getImageData(sel.srcX, sel.srcY, width, height);
    for (let i = 0; i < sel.mask.length; i++) {
      if (sel.mask[i]) data.data.fill(255, i * 4, i * 4 + 4);
    }
    ctx.putImageData(data, sel.srcX, sel.srcY);
  };

  // Detach the pixels from the board; the whole move/resize becomes one undo step
  const liftSelection = (sel: Selection, keepOriginal: boolean): Selection => {
    pushHistory();
    if (!keepOriginal) eraseSource(sel);
    return { ...sel, lifted: true };
  };

  const stampSelection = (sel: Selection) => {
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.drawImage(sel.pixels, sel.x, sel.y, sel.w, sel.h);
  };

  const commitSelection = () => {
    const sel = selectionRef.current;
    if (!sel) return;
    if (sel.lifted) stampSelection(sel);
    setSelection(null);
  };

  const deleteSelection = () => {
    const sel = selectionRef.current;
    if (!sel) return;
    if (!sel.lifted) {
      pushHistory();
      eraseSource(sel);
    }
    setSelection(null);
  };

  const copySelection = (pastes = 1) => {
    const sel = selectionRef.current;
    if (!sel) return;
    const pixels = makeCanvas(Math.round(sel.w), Math.round(sel.h));
    pixels.getContext('2d')?.drawImage(sel.pixels, 0, 0, pixels.width, pixels.height);
    clipboardRef.current = { pixels, outline: sel.outline, x: sel.x, y: sel.y, pastes };
    clipboardFreshRef.current = true;
    setHasClip(true);
    // Best effort: also put it on the system clipboard so it can be pasted into other apps
    try {
      const blob = new Promise<Blob>((resolve, reject) =>
        pixels.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
      );
      navigator.clipboard?.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
    } catch {}
  };

  const cutSelection = () => {
    copySelection(0);
    deleteSelection();
  };

  const pasteClipboard = (hasExternalImage = false) => {
    const clip = clipboardRef.current;
    const canvas = canvasRef.current;
    if (!clip || !canvas || (hasExternalImage && !clipboardFreshRef.current)) return false;
    commitSelection();
    commitText();
    const offset = clip.pastes * 20;
    clip.pastes++;
    const { width: w, height: h } = clip.pixels;
    const x = Math.max(0, Math.min(clip.x + offset, canvas.width - Math.min(w, 40)));
    const y = Math.max(0, Math.min(clip.y + offset, canvas.height - Math.min(h, 40)));
    const pixels = makeCanvas(w, h);
    pixels.getContext('2d')?.drawImage(clip.pixels, 0, 0);
    pushHistory();
    setSelection({ id: Date.now(), pixels, x, y, w, h, srcX: x, srcY: y, mask: null, lifted: true, outline: clip.outline });
    if (!isSelectTool(tool)) setTool('rectSelect');
    return true;
  };

  const selectAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    commitSelection();
    commitText();
    setTool('rectSelect');
    createSelection([{ x: 0, y: 0 }, { x: canvas.width, y: canvas.height }], false);
  };

  const nudgeSelection = (dx: number, dy: number) => {
    let sel = selectionRef.current;
    if (!sel) return;
    if (!sel.lifted) sel = liftSelection(sel, false);
    setSelection({ ...sel, x: sel.x + dx, y: sel.y + dy });
  };

  const startSelDrag = (e: PointerEvent<HTMLElement>, type: HandleType) => {
    let sel = selectionRef.current;
    if (!sel) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Ctrl/Alt-drag leaves a copy behind, like Paint
    const duplicate = type === 'move' && (e.ctrlKey || e.metaKey || e.altKey);
    if (!sel.lifted) sel = liftSelection(sel, duplicate);
    else if (duplicate) stampSelection(sel);
    setSelection(sel);
    selDragRef.current = { type, startMouseX: e.clientX, startMouseY: e.clientY, start: sel };
  };

  const moveSelDrag = (e: PointerEvent<HTMLElement>) => {
    const drag = selDragRef.current;
    const sel = selectionRef.current;
    if (!drag || !sel) return;
    const dx = Math.round(e.clientX - drag.startMouseX);
    const dy = Math.round(e.clientY - drag.startMouseY);
    const { x, y, w, h } = drag.start;
    const left = drag.type === 'tl' || drag.type === 'bl';
    const top = drag.type === 'tl' || drag.type === 'tr';
    if (drag.type === 'move') {
      setSelection({ ...sel, x: x + dx, y: y + dy });
      return;
    }
    const nw = Math.max(SEL_MIN, left ? w - dx : w + dx);
    const nh = Math.max(SEL_MIN, top ? h - dy : h + dy);
    setSelection({ ...sel, x: left ? x + w - nw : x, y: top ? y + h - nh : y, w: nw, h: nh });
  };

  const endSelDrag = () => { selDragRef.current = null; };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Let the text box keep its own native shortcuts while typing
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (confirmClear) {
      // Enter presses the focused button natively
      if (key === 'escape') { e.preventDefault(); setConfirmClear(false); }
      return;
    }
    if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) { e.preventDefault(); redo(); return; }
    if (mod && key === 'a') { e.preventDefault(); selectAll(); return; }
    if (!selectionRef.current) return;
    if (mod && key === 'c') { e.preventDefault(); copySelection(); }
    else if (mod && key === 'x') { e.preventDefault(); cutSelection(); }
    else if (key === 'delete' || key === 'backspace') { e.preventDefault(); deleteSelection(); }
    else if (key === 'escape' || key === 'enter') { e.preventDefault(); commitSelection(); }
    else if (key.startsWith('arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      nudgeSelection(
        key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
        key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0,
      );
    }
  };

  useEffect(() => {
    liveRef.current = { placeText, beginSelect, updateSelect, endSelect, keyDown: handleKeyDown, pasteClipboard, commitSelection };
  });

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
    if (selDraftRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) updateSelect({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      return;
    }
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
    if (selDraftRef.current) endSelect();
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

  const selActionsAbove = selection ? selection.y >= 64 : true;
  const selControlsLeft = selection
    ? Math.max(8 - selection.x, Math.min(selection.w - SEL_CONTROLS_WIDTH, window.innerWidth - 8 - SEL_CONTROLS_WIDTH - selection.x))
    : 0;
  const draftStart = selDraft?.[0];
  const draftEnd = selDraft?.[selDraft.length - 1];

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
      onMouseLeave={handleGlobalMouseUp}
    >
      {/* Floating bottom toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center sm:gap-1 px-2 sm:px-3 py-2 max-w-[calc(100vw-16px)] overflow-x-auto bg-white rounded-full shadow-2xl border border-gray-100">
        <button onClick={() => selectTool('rectSelect')} aria-label="Rectangle Select" title="Rectangle select" className={toolBtn(tool === 'rectSelect')}>
          <RectSelectIcon />
        </button>
        <button onClick={() => selectTool('lassoSelect')} aria-label="Free-form Select" title="Free-form select" className={toolBtn(tool === 'lassoSelect')}>
          <LassoIcon />
        </button>
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

        <button onClick={() => setConfirmClear(true)} aria-label="Clear" title="Clear" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-full text-sm text-red-500 hover:bg-red-50 transition-all">
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      {/* Clear confirmation */}
      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-[2px]"
          onPointerDown={(e) => { if (e.target === e.currentTarget) setConfirmClear(false); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-title"
            aria-describedby="clear-desc"
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center"
          >
            <div className="mx-auto mb-4 w-14 h-14 flex items-center justify-center rounded-full bg-red-50 text-red-500 text-xl">
              <FontAwesomeIcon icon={faTrash} />
            </div>
            <h2 id="clear-title" className="text-lg font-semibold text-gray-900">Clear the whiteboard?</h2>
            <p id="clear-desc" className="mt-1 text-sm text-gray-500">Everything on the board will be erased. You can still undo this.</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 h-12 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={() => { setConfirmClear(false); clearCanvas(); }}
                className="flex-1 h-12 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Selection being drawn */}
      {selDraft && draftStart && draftEnd && (
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 22 }}>
          {tool === 'lassoSelect' ? (
            <>
              <polyline points={selDraft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffffff" strokeWidth={2} />
              <polyline points={selDraft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1f2937" strokeWidth={1} strokeDasharray="4 3" />
            </>
          ) : (
            <>
              {(['#ffffff', '#1f2937'] as const).map((stroke) => (
                <rect
                  key={stroke}
                  x={Math.min(draftStart.x, draftEnd.x) + 0.5}
                  y={Math.min(draftStart.y, draftEnd.y) + 0.5}
                  width={Math.abs(draftEnd.x - draftStart.x)}
                  height={Math.abs(draftEnd.y - draftStart.y)}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={stroke === '#ffffff' ? 2 : 1}
                  strokeDasharray={stroke === '#ffffff' ? undefined : '4 3'}
                />
              ))}
            </>
          )}
        </svg>
      )}

      {/* Floating selection */}
      {selection && (
        <div
          className="absolute"
          style={{ left: selection.x, top: selection.y, width: selection.w, height: selection.h, zIndex: 22 }}
        >
          <div
            className="absolute inset-0 cursor-move"
            style={{ outline: '1px dashed #2563eb', touchAction: 'none' }}
            onPointerDown={(e) => startSelDrag(e, 'move')}
            onPointerMove={moveSelDrag}
            onPointerUp={endSelDrag}
          >
            <SelectionPixels source={selection.pixels} />
            {selection.outline && (
              <svg
                className="absolute inset-0 pointer-events-none overflow-visible"
                width="100%"
                height="100%"
                viewBox={`0 0 ${selection.outline.w} ${selection.outline.h}`}
                preserveAspectRatio="none"
              >
                <path d={selection.outline.d} fill="none" stroke="#ffffff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <path d={selection.outline.d} fill="none" stroke="#1f2937" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>

          {/* Corner resize handles */}
          {handles.map(({ type, style }) => (
            <div
              key={type}
              className="absolute w-3 h-3 bg-white border-2 border-blue-600 rounded-sm"
              style={{ ...style, touchAction: 'none' }}
              onPointerDown={(e) => startSelDrag(e, type)}
              onPointerMove={moveSelDrag}
              onPointerUp={endSelDrag}
            />
          ))}

          {/* Copy / cut / paste / delete / done */}
          <div
            className="absolute flex items-center gap-1 p-1 bg-white rounded-full shadow-lg border border-gray-100 whitespace-nowrap"
            style={{
              left: selControlsLeft,
              ...(selActionsAbove ? { bottom: '100%', marginBottom: 12 } : { top: '100%', marginTop: 12 }),
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {([
              { label: 'Copy', hint: 'Ctrl+C', icon: faCopy },
              { label: 'Cut', hint: 'Ctrl+X', icon: faScissors },
              { label: 'Paste', hint: 'Ctrl+V', icon: faPaste },
              { label: 'Delete', hint: 'Del', icon: faTrashCan },
            ] as const).map(({ label, hint, icon }) => (
              <button
                key={label}
                onClick={() => {
                  if (label === 'Copy') copySelection();
                  else if (label === 'Cut') cutSelection();
                  else if (label === 'Paste') pasteClipboard();
                  else deleteSelection();
                }}
                disabled={label === 'Paste' && !hasClip}
                className="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
                aria-label={`${label} selection`}
                title={`${label} (${hint})`}
              >
                <FontAwesomeIcon icon={icon} />
              </button>
            ))}
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <button
              onClick={commitSelection}
              className="w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 cursor-pointer"
              aria-label="Done with selection"
              title="Done (Esc)"
            >
              <FontAwesomeIcon icon={faCheck} />
            </button>
          </div>
        </div>
      )}

      {/* Paste button for touch screens once the selection is gone */}
      {isSelectTool(tool) && hasClip && !selection && !selDraft && (
        <button
          onClick={() => pasteClipboard()}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 h-10 px-4 flex items-center gap-2 bg-white text-gray-700 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 text-sm font-semibold cursor-pointer"
          aria-label="Paste"
          title="Paste (Ctrl+V)"
        >
          <FontAwesomeIcon icon={faPaste} />
          Paste
        </button>
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

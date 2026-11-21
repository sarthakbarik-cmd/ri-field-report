import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, Eraser, Undo2, Maximize2, Check, X } from 'lucide-react';

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: Point[];
  color: string;
  baseWidth: number;
}

export interface SignaturePadProps {
  label: string;
  sublabel?: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  defaultPencilOnly?: boolean;
  compact?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  sublabel,
  value,
  onChange,
  height = 132,
  defaultPencilOnly = false,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [pencilOnly, setPencilOnly] = useState(defaultPencilOnly);
  const [inkColor, setInkColor] = useState<'#1e3a8a' | '#0f172a'>('#1e3a8a');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const lastCommittedValueRef = useRef<string | undefined>(value);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastPointerType, setLastPointerType] = useState<string | null>(null);

  // Sync external value changes (e.g., "Apply Saved RI Signature" or switching records)
  useEffect(() => {
    if (value !== lastCommittedValueRef.current) {
      lastCommittedValueRef.current = value;
      strokesRef.current = [];
      setStrokes([]);
    }
  }, [value]);

  // Redraw strokes + optional existing image onto canvas
  const redrawCanvas = useCallback(
    (strokesToDraw: Stroke[], bgImageUrl?: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = canvas.clientWidth || 420;
      const cssHeight = canvas.clientHeight || height;

      if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const drawStrokes = () => {
        for (const stroke of strokesToDraw) {
          if (stroke.points.length === 0) continue;
          ctx.strokeStyle = stroke.color;
          ctx.fillStyle = stroke.color;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (stroke.points.length === 1) {
            const p = stroke.points[0];
            ctx.beginPath();
            ctx.arc(p.x, p.y, stroke.baseWidth * 0.6, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          for (let i = 1; i < stroke.points.length; i++) {
            const prev = stroke.points[i - 1];
            const curr = stroke.points[i];
            const next = stroke.points[i + 1];

            const pFactor = curr.pressure > 0 && curr.pressure !== 0.5 ? 0.55 + curr.pressure * 0.9 : 1;
            ctx.lineWidth = Math.max(1.2, Math.min(4.2, stroke.baseWidth * pFactor));

            ctx.beginPath();
            if (i === 1) {
              ctx.moveTo(prev.x, prev.y);
            } else {
              const prevPrev = stroke.points[i - 2];
              ctx.moveTo((prevPrev.x + prev.x) / 2, (prevPrev.y + prev.y) / 2);
            }

            if (next) {
              const midX = (prev.x + curr.x) / 2;
              const midY = (prev.y + curr.y) / 2;
              ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
            } else {
              ctx.quadraticCurveTo(prev.x, prev.y, curr.x, curr.y);
            }
            ctx.stroke();
          }
        }
      };

      if (bgImageUrl && strokesToDraw.length === 0) {
        const img = new Image();
        img.onload = () => {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, cssWidth, cssHeight);
          const scale = Math.min(cssWidth / img.width, cssHeight / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const offsetX = (cssWidth - drawW) / 2;
          const offsetY = (cssHeight - drawH) / 2;
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        };
        img.src = bgImageUrl;
      } else {
        drawStrokes();
      }
    },
    [height]
  );

  useEffect(() => {
    redrawCanvas(strokes, strokes.length === 0 ? value : undefined);
  }, [strokes, value, redrawCanvas]);

  useEffect(() => {
    const handleResize = () => {
      redrawCanvas(strokesRef.current, strokesRef.current.length === 0 ? value : undefined);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [value, redrawCanvas]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const commitCanvasToParent = (nextStrokes: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (nextStrokes.length === 0) {
      lastCommittedValueRef.current = '';
      onChange('');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    lastCommittedValueRef.current = dataUrl;
    onChange(dataUrl);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pencilOnly && e.pointerType === 'touch') {
      // Palm rejection: ignore finger/palm touch when Pencil-Only mode is active
      return;
    }
    e.preventDefault();
    setLastPointerType(e.pointerType);

    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }

    const pt = getPointerPos(e);
    const newStroke: Stroke = {
      points: [pt],
      color: inkColor,
      baseWidth: e.pointerType === 'pen' ? 2.1 : 2.3,
    };
    currentStrokeRef.current = newStroke;
    setIsDrawing(true);

    const next = [...strokesRef.current, newStroke];
    strokesRef.current = next;
    setStrokes(next);
    redrawCanvas(next);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    if (pencilOnly && e.pointerType === 'touch') return;
    e.preventDefault();

    const pt = getPointerPos(e);
    const lastPt = currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
    if (lastPt && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) < 0.8) return;

    currentStrokeRef.current.points.push(pt);
    const updatedStrokes = [...strokesRef.current.slice(0, -1), { ...currentStrokeRef.current }];
    strokesRef.current = updatedStrokes;
    setStrokes(updatedStrokes);
    redrawCanvas(updatedStrokes);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
    setIsDrawing(false);
    currentStrokeRef.current = null;
    commitCanvasToParent(strokesRef.current);
  };

  const handleClear = () => {
    strokesRef.current = [];
    setStrokes([]);
    currentStrokeRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    lastCommittedValueRef.current = '';
    onChange('');
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) {
      handleClear();
      return;
    }
    const next = strokesRef.current.slice(0, -1);
    strokesRef.current = next;
    setStrokes(next);
    redrawCanvas(next);
    setTimeout(() => commitCanvasToParent(next), 20);
  };

  const hasSignature = strokes.length > 0 || Boolean(value);

  return (
    <div ref={containerRef} className="space-y-1.5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-slate-800 block leading-tight">{label}</span>
          {sublabel && <span className="text-[11px] text-slate-500 block">{sublabel}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Palm Rejection Toggle for iPad Apple Pencil */}
          <button
            type="button"
            onClick={() => setPencilOnly((prev) => !prev)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium border transition whitespace-nowrap ${
              pencilOnly
                ? 'bg-blue-50 text-blue-800 border-blue-300'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Enable Pencil-Only mode on iPad to ignore palm/finger touches while signing with Apple Pencil"
          >
            {pencilOnly ? 'Apple Pencil Only' : 'Pencil & Touch'}
          </button>

          {/* Ink Color Toggle */}
          {!compact && (
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setInkColor('#1e3a8a')}
                className={`px-2 py-1 text-[11px] font-medium transition ${
                  inkColor === '#1e3a8a' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
                title="Blue Pen Ink"
              >
                Blue
              </button>
              <button
                type="button"
                onClick={() => setInkColor('#0f172a')}
                className={`px-2 py-1 text-[11px] font-medium transition ${
                  inkColor === '#0f172a' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
                title="Black Ink"
              >
                Black
              </button>
            </div>
          )}

          {strokes.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
              title="Undo Last Stroke"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          )}

          {hasSignature && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-medium flex items-center gap-1 transition"
              title="Clear Signature"
            >
              <Eraser className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
            title="Open Large iPad Signing Box"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Drawing Surface */}
      <div className="relative rounded-lg border border-slate-300 bg-white overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ width: '100%', height: `${height}px`, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        />

        {/* Baseline signing guide line */}
        <div
          className="pointer-events-none absolute left-5 right-5 bottom-4 border-b border-dashed border-slate-300"
          aria-hidden="true"
        />

        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <PenTool className="w-3.5 h-3.5" />
              <span>
                {pencilOnly ? 'Sign here with Apple Pencil' : 'Sign here with Apple Pencil, finger, or mouse'}
              </span>
            </div>
          </div>
        )}

        {hasSignature && lastPointerType && (
          <span className="pointer-events-none absolute top-1.5 right-2 text-[10px] text-slate-400 font-mono">
            {lastPointerType === 'pen' ? 'Apple Pencil' : lastPointerType === 'touch' ? 'Touch' : 'Mouse'}
          </span>
        )}
      </div>

      {/* Expanded Full-Width iPad Signing Modal */}
      {isExpanded && (
        <ExpandedSignatureModal
          label={label}
          sublabel={sublabel}
          initialValue={value}
          initialInkColor={inkColor}
          initialPencilOnly={pencilOnly}
          onSave={(newDataUrl) => {
            setStrokes([]);
            onChange(newDataUrl);
            setIsExpanded(false);
          }}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};

interface ExpandedSignatureModalProps {
  label: string;
  sublabel?: string;
  initialValue?: string;
  initialInkColor: '#1e3a8a' | '#0f172a';
  initialPencilOnly: boolean;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

const ExpandedSignatureModal: React.FC<ExpandedSignatureModalProps> = ({
  label,
  sublabel,
  initialValue,
  initialInkColor,
  initialPencilOnly,
  onSave,
  onClose,
}) => {
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pencilOnly, setPencilOnly] = useState(initialPencilOnly);
  const [inkColor, setInkColor] = useState<'#1e3a8a' | '#0f172a'>(initialInkColor);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [clearedInitial, setClearedInitial] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const redraw = useCallback(
    (strokesList: Stroke[]) => {
      const canvas = modalCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth || 720;
      const cssH = canvas.clientHeight || 280;
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const renderStrokes = () => {
        for (const stroke of strokesList) {
          if (stroke.points.length === 0) continue;
          ctx.strokeStyle = stroke.color;
          ctx.fillStyle = stroke.color;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (stroke.points.length === 1) {
            ctx.beginPath();
            ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.baseWidth * 0.7, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          for (let i = 1; i < stroke.points.length; i++) {
            const prev = stroke.points[i - 1];
            const curr = stroke.points[i];
            const next = stroke.points[i + 1];
            const pFactor = curr.pressure > 0 && curr.pressure !== 0.5 ? 0.55 + curr.pressure * 0.9 : 1;
            ctx.lineWidth = Math.max(1.5, Math.min(5, stroke.baseWidth * pFactor));

            ctx.beginPath();
            if (i === 1) {
              ctx.moveTo(prev.x, prev.y);
            } else {
              const prevPrev = stroke.points[i - 2];
              ctx.moveTo((prevPrev.x + prev.x) / 2, (prevPrev.y + prev.y) / 2);
            }
            if (next) {
              ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
            } else {
              ctx.quadraticCurveTo(prev.x, prev.y, curr.x, curr.y);
            }
            ctx.stroke();
          }
        }
      };

      if (initialValue && !clearedInitial && strokesList.length === 0) {
        const img = new Image();
        img.onload = () => {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, cssW, cssH);
          ctx.drawImage(img, 0, 0, cssW, cssH);
        };
        img.src = initialValue;
      } else {
        renderStrokes();
      }
    },
    [initialValue, clearedInitial]
  );

  useEffect(() => {
    redraw(strokes);
  }, [strokes, redraw]);

  const getPt = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = modalCanvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pencilOnly && e.pointerType === 'touch') return;
    e.preventDefault();
    try {
      modalCanvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    const pt = getPt(e);
    const s: Stroke = {
      points: [pt],
      color: inkColor,
      baseWidth: e.pointerType === 'pen' ? 2.6 : 2.8,
    };
    currentStrokeRef.current = s;
    setIsDrawing(true);
    setClearedInitial(true);
    const next = [...strokes, s];
    setStrokes(next);
    redraw(next);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    if (pencilOnly && e.pointerType === 'touch') return;
    e.preventDefault();
    const pt = getPt(e);
    const last = currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.8) return;
    currentStrokeRef.current.points.push(pt);
    const next = [...strokes.slice(0, -1), { ...currentStrokeRef.current }];
    setStrokes(next);
    redraw(next);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    currentStrokeRef.current = null;
  };

  const handleDone = () => {
    const canvas = modalCanvasRef.current;
    if (!canvas) {
      onClose();
      return;
    }
    if (strokes.length === 0 && clearedInitial) {
      onSave('');
      return;
    }
    if (strokes.length === 0 && initialValue && !clearedInitial) {
      onSave(initialValue);
      return;
    }
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold">{label}</h4>
            {sublabel && <p className="text-xs text-slate-300">{sublabel}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPencilOnly((p) => !p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                pencilOnly
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {pencilOnly ? 'Apple Pencil Only (Palm Rejection ON)' : 'Pencil & Finger Touch'}
            </button>

            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setInkColor('#1e3a8a')}
                className={`px-2.5 py-1.5 text-xs font-semibold ${
                  inkColor === '#1e3a8a' ? 'bg-blue-900 text-white' : 'text-slate-700'
                }`}
              >
                Blue Ink
              </button>
              <button
                type="button"
                onClick={() => setInkColor('#0f172a')}
                className={`px-2.5 py-1.5 text-xs font-semibold ${
                  inkColor === '#0f172a' ? 'bg-slate-900 text-white' : 'text-slate-700'
                }`}
              >
                Black Ink
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = strokes.slice(0, -1);
                setStrokes(next);
                redraw(next);
              }}
              disabled={strokes.length === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStrokes([]);
                setClearedInitial(true);
                const c = modalCanvasRef.current;
                if (c) {
                  c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white relative">
          <div className="relative rounded-xl border-2 border-slate-300 bg-slate-50/30 overflow-hidden">
            <canvas
              ref={modalCanvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{ width: '100%', height: '260px', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
            />
            <div className="pointer-events-none absolute left-8 right-8 bottom-7 border-b border-dashed border-slate-300" />
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>Apply Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import { useRef, useState, useEffect } from "react";
import { COLORS } from "../../lib/colors";

// Canvas signature capture. Pointer events (not separate mouse/touch
// handlers) unify mouse, touch, and stylus input in one code path — the
// common case here is handing the phone to a client to sign with a finger.
export function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    sizeRef.current = { w: rect.width, h: rect.height };
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    canvasRef.current.setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    drawingRef.current = true;
  };
  const handlePointerMove = (e) => {
    if (!drawingRef.current) return;
    const { x, y } = getPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };
  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const handleClear = () => {
    const { w, h } = sizeRef.current;
    ctxRef.current.clearRect(0, 0, w, h);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (!hasDrawn) return;
    onSave(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          width: "100%", height: 160, borderRadius: 8, border: `1px solid ${COLORS.border}`,
          background: "#FFFFFF", touchAction: "none", cursor: "crosshair", display: "block",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={handleClear}
          style={{ flex: 1, minHeight: 40, borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Clear
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{ flex: 1, minHeight: 40, borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "#FBFAF7", color: COLORS.sub, fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!hasDrawn}
          style={{
            flex: 1, minHeight: 40, borderRadius: 7, border: "none",
            background: hasDrawn ? `linear-gradient(135deg, ${COLORS.wood1}, ${COLORS.wood2})` : COLORS.border,
            color: hasDrawn ? "#FFFFFF" : COLORS.sub,
            fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 600,
            cursor: hasDrawn ? "pointer" : "default",
          }}
        >
          Save signature
        </button>
      </div>
    </div>
  );
}

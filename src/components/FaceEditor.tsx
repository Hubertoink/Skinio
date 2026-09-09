import { useEffect, useRef } from "react";
import {
  faces,
  SIDE_LABELS,
  type Face,
  type Part,
  type Layer,
  type Skin,
} from "../core/skin";
import { skinCanvas } from "../core/images";
interface Props {
  skin: Skin;
  part: Part;
  layer: Layer;
  faceId: string;
  grid: boolean;
  disabled: boolean;
  onFace: (id: string) => void;
  onPaint: (f: Face, x: number, y: number) => void;
  onStart: () => void;
  onEnd: () => void;
}
export function FaceEditor(p: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const fs = faces(p.skin.model).filter(
    (f) => f.part === p.part && f.layer === p.layer,
  );
  const f = fs.find((f) => f.side === p.faceId) ?? fs[0];
  useEffect(() => {
    const c = ref.current!,
      ctx = c.getContext("2d")!;
    const scale = 16;
    c.width = f.w * scale;
    c.height = f.h * scale;
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#333d37" : "#26312b";
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      skinCanvas(p.skin),
      f.x,
      f.y,
      f.w,
      f.h,
      0,
      0,
      c.width,
      c.height,
    );
    if (p.grid) {
      ctx.strokeStyle = "#ffffff25";
      ctx.lineWidth = 1;
      for (let x = 0; x <= f.w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * scale + 0.5, 0);
        ctx.lineTo(x * scale + 0.5, c.height);
        ctx.stroke();
      }
      for (let y = 0; y <= f.h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * scale + 0.5);
        ctx.lineTo(c.width, y * scale + 0.5);
        ctx.stroke();
      }
    }
  }, [p.skin, f.id, p.grid]);
  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (p.disabled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * f.w),
      y = Math.floor(((e.clientY - r.top) / r.height) * f.h);
    if (x >= 0 && y >= 0 && x < f.w && y < f.h) p.onPaint(f, x, y);
  };
  const end = () => {
    if (drawing.current) {
      drawing.current = false;
      p.onEnd();
    }
  };
  return (
    <div className="face-editor">
      <div className="face-tabs">
        {fs.map((a) => (
          <button
            key={a.id}
            className={a.id === f.id ? "active" : ""}
            onClick={() => p.onFace(a.side)}
          >
            {SIDE_LABELS[a.side]}
          </button>
        ))}
      </div>
      <div className="face-canvas-wrap">
        <canvas
          ref={ref}
          data-testid="face-canvas"
          aria-label="Körperfläche bemalen"
          onPointerDown={(e) => {
            if (p.disabled || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            p.onStart();
            paint(e);
          }}
          onPointerMove={(e) => {
            if (drawing.current) paint(e);
          }}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <div className="face-meta">
          <span>
            {f.w} × {f.h}
          </span>
          <small>Pixel pro Fläche</small>
          <small>
            Jedes Feld ist ein Skin-Pixel.
            <br />
            Auch verdeckte Seiten sind hier erreichbar.
          </small>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  dimensions,
  faces,
  type Face,
  type Part,
  type Layer,
  type Skin,
} from "../core/skin";
import { skinCanvas } from "../core/images";
export type Tool = "brush" | "erase" | "pick" | "fill" | "orbit";
interface Props {
  skin: Skin;
  parts: Part[];
  layer: Layer;
  tool: Tool;
  grid: boolean;
  outer: boolean;
  isolate: boolean;
  view: number;
  locked: boolean;
  disabled: boolean;
  onPaint: (f: Face, x: number, y: number) => void;
  onStart: () => void;
  onEnd: () => void;
  onHover: (value: string) => void;
}
export function Viewport(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const texture = useRef<THREE.CanvasTexture | null>(null);
  const reset = useRef<(view: number) => void>(() => {});
  const lock = useRef<() => void>(() => {});
  const [error, setError] = useState("");
  useEffect(() => {
    const el = host.current!;
    const scene = new THREE.Scene();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(
        "3D ist nicht verfügbar. Du kannst den Skin weiterhin im Flächeneditor bemalen.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 16, 0);
    controls.enableDamping = true;
    controls.minDistance = 30;
    controls.maxDistance = 150;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    reset.current = (v: number) => {
      // Flush previous orbit inertia before setting an exact axis view.
      controls.enableDamping = false;
      controls.update();
      const fixed = latest.current.locked;
      if (v % 5 === 0) camera.position.set(40, 31, 63);
      else if (v % 5 === 1) camera.position.set(0, fixed ? 16 : 17, 76);
      else if (v % 5 === 2) camera.position.set(0, fixed ? 16 : 17, -76);
      else if (v % 5 === 3) camera.position.set(76, fixed ? 16 : 20, 0);
      else camera.position.set(-76, fixed ? 16 : 20, 0);
      controls.target.set(0, 16, 0);
      controls.update();
      controls.enableDamping = !fixed;
    };
    lock.current = () => {
      const position = camera.position.clone(),
        target = controls.target.clone();
      controls.enableDamping = false;
      controls.update();
      camera.position.copy(position);
      controls.target.copy(target);
      controls.enableRotate = !latest.current.locked;
      controls.enablePan = !latest.current.locked;
      controls.update();
      controls.enableDamping = !latest.current.locked;
      if (latest.current.locked && latest.current.view % 5 !== 0)
        reset.current(latest.current.view);
    };
    reset.current(latest.current.view);
    lock.current();
    const tex = new THREE.CanvasTexture(skinCanvas(latest.current.skin));
    texture.current = tex;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.FrontSide,
    });
    const meshes: THREE.Mesh[] = [];
    const grids: THREE.LineSegments[] = [];
    for (const f of faces(props.skin.model)) {
      const [w, h, d] = dimensions(f.part, props.skin.model);
      const pad = f.layer === "outer" ? (f.part === "head" ? 0.5 : 0.25) : 0;
      const geometry = new THREE.PlaneGeometry(f.w + pad * 2, f.h + pad * 2);
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i),
          v = f.side === "bottom" ? 1 - uv.getY(i) : uv.getY(i);
        uv.setXY(i, (f.x + u * f.w) / 64, 1 - (f.y + (1 - v) * f.h) / 64);
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.face = f;
      const centerX =
        f.part === "rightArm"
          ? -(4 + w / 2)
          : f.part === "leftArm"
            ? 4 + w / 2
            : f.part === "rightLeg"
              ? -2
              : f.part === "leftLeg"
                ? 2
                : 0;
      const centerY = f.part === "head" ? 28 : f.part.endsWith("Leg") ? 6 : 18;
      mesh.position.set(centerX, centerY, 0);
      if (f.side === "front") mesh.position.z += d / 2 + pad;
      if (f.side === "back") {
        mesh.position.z -= d / 2 + pad;
        mesh.rotation.y = Math.PI;
      }
      if (f.side === "left") {
        mesh.position.x += w / 2 + pad;
        mesh.rotation.y = Math.PI / 2;
      }
      if (f.side === "right") {
        mesh.position.x -= w / 2 + pad;
        mesh.rotation.y = -Math.PI / 2;
      }
      if (f.side === "top") {
        mesh.position.y += h / 2 + pad;
        mesh.rotation.x = -Math.PI / 2;
      }
      if (f.side === "bottom") {
        mesh.position.y -= h / 2 + pad;
        mesh.rotation.x = Math.PI / 2;
      }
      scene.add(mesh);
      meshes.push(mesh);
      const points: number[] = [];
      const fw = f.w + pad * 2,
        fh = f.h + pad * 2;
      for (let x = 0; x <= f.w; x++) {
        const px = -fw / 2 + (x / f.w) * fw;
        points.push(px, -fh / 2, 0.015, px, fh / 2, 0.015);
      }
      for (let y = 0; y <= f.h; y++) {
        const py = -fh / 2 + (y / f.h) * fh;
        points.push(-fw / 2, py, 0.015, fw / 2, py, 0.015);
      }
      const gridGeo = new THREE.BufferGeometry();
      gridGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(points, 3),
      );
      const grid = new THREE.LineSegments(
        gridGeo,
        new THREE.LineBasicMaterial({
          color: "#bcd6c4",
          transparent: true,
          opacity: 0.21,
          depthWrite: false,
        }),
      );
      grid.userData.face = f;
      mesh.add(grid);
      grids.push(grid);
    }
    const ground = new THREE.GridHelper(90, 18, "#435049", "#28342e");
    ground.position.y = -0.65;
    scene.add(ground);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let drawing = false;
    let previous = "";
    const hit = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const p = latest.current;
      const matches = meshes.filter(
        (m) => m.visible && m.userData.face.layer === p.layer,
      );
      const intersection = raycaster.intersectObjects(matches, false)[0];
      if (!intersection?.uv) return;
      const f = intersection.object.userData.face as Face;
      const x = Math.min(
        f.w - 1,
        Math.max(0, Math.floor(intersection.uv.x * 64 - f.x + 1e-6)),
      );
      const y = Math.min(
        f.h - 1,
        Math.max(0, Math.floor((1 - intersection.uv.y) * 64 - f.y + 1e-6)),
      );
      p.onHover(`${f.id} · ${x}, ${y}`);
      if (!p.parts.includes(f.part)) return;
      return { f, x, y };
    };
    const draw = (e: PointerEvent) => {
      const at = hit(e);
      if (!at) {
        previous = "";
        return;
      }
      const key = `${at.f.id}/${at.x}/${at.y}`;
      if (key !== previous) {
        latest.current.onPaint(at.f, at.x, at.y);
        previous = key;
      }
    };
    const down = (e: PointerEvent) => {
      if (
        e.button !== 0 ||
        latest.current.tool === "orbit" ||
        e.altKey ||
        latest.current.disabled
      )
        return;
      if (!hit(e)) return;
      controls.enabled = false;
      e.stopImmediatePropagation();
      renderer.domElement.setPointerCapture(e.pointerId);
      drawing = true;
      previous = "";
      latest.current.onStart();
      draw(e);
    };
    const move = (e: PointerEvent) => {
      if (drawing) draw(e);
      else hit(e);
    };
    const up = () => {
      if (drawing) latest.current.onEnd();
      drawing = false;
      controls.enabled = true;
      previous = "";
    };
    const context = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener("pointerdown", down, true);
    renderer.domElement.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    renderer.domElement.addEventListener("contextmenu", context);
    const observer = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    });
    observer.observe(el);
    let frame = 0;
    const animate = () => {
      const p = latest.current;
      for (const mesh of meshes) {
        const f = mesh.userData.face as Face;
        mesh.visible =
          (f.layer === "base" || p.outer || p.layer === "outer") &&
          (!p.isolate || p.parts.includes(f.part));
      }
      for (const grid of grids) {
        const f = grid.userData.face as Face;
        grid.visible =
          p.grid && f.layer === p.layer && p.parts.includes(f.part);
      }
      renderer.domElement.style.cursor = p.disabled
        ? "default"
        : p.tool === "orbit"
          ? "grab"
          : "crosshair";
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down, true);
      renderer.domElement.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      renderer.domElement.removeEventListener("contextmenu", context);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      tex.dispose();
      texture.current = null;
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [props.skin.model]);
  useEffect(() => {
    if (texture.current) {
      texture.current.image = skinCanvas(props.skin);
      texture.current.needsUpdate = true;
    }
  }, [props.skin]);
  useEffect(() => reset.current(props.view), [props.view]);
  useEffect(() => lock.current(), [props.locked]);
  return (
    <div className="viewport" ref={host} data-testid="viewport">
      {error && <div className="viewport-error">{error}</div>}
    </div>
  );
}

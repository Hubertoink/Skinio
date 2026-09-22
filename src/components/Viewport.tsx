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
import { POSES } from "../core/poses";
import { skinCanvas } from "../core/images";
export type Tool = "brush" | "erase" | "pick" | "fill" | "orbit";
interface Props {
  pose: string;
  captureRef: { current: (() => string) | null };
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
    const body = new THREE.Group();
    scene.add(body);
    const joints = new Map<Part, THREE.Group>();
    const deformers: {
      geometry: THREE.BufferGeometry;
      original: Float32Array;
      matrix: THREE.Matrix4;
      inverse: THREE.Matrix4;
      part: Part;
    }[] = [];
    const meshes: THREE.Mesh[] = [];
    const grids: THREE.LineSegments[] = [];
    for (const f of faces(props.skin.model)) {
      const [w, h, d] = dimensions(f.part, props.skin.model);
      const pad = f.layer === "outer" ? (f.part === "head" ? 0.5 : 0.25) : 0;
      const geometry = new THREE.PlaneGeometry(
        f.w + pad * 2,
        f.h + pad * 2,
        1,
        f.h,
      );
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
      let joint = joints.get(f.part);
      if (!joint) {
        joint = new THREE.Group();
        joint.position.set(
          centerX,
          f.part === "head"
            ? 24
            : f.part.endsWith("Leg")
              ? 12
              : f.part === "torso"
                ? 12
                : 22,
          0,
        );
        body.add(joint);
        joints.set(f.part, joint);
      }
      mesh.position.sub(joint.position);
      joint.add(mesh);
      meshes.push(mesh);
      const points: number[] = [];
      const fw = f.w + pad * 2,
        fh = f.h + pad * 2;
      for (let x = 0; x <= f.w; x++) {
        const px = -fw / 2 + (x / f.w) * fw;
        for (let y = 0; y < f.h; y++) {
          points.push(
            px,
            -fh / 2 + (y / f.h) * fh,
            0.015,
            px,
            -fh / 2 + ((y + 1) / f.h) * fh,
            0.015,
          );
        }
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
      if (f.part.endsWith("Leg") || f.part.endsWith("Arm")) {
        mesh.updateMatrix();
        for (const geo of [geometry, gridGeo]) {
          deformers.push({
            geometry: geo,
            original: new Float32Array(geo.attributes.position.array),
            matrix: mesh.matrix.clone(),
            inverse: mesh.matrix.clone().invert(),
            part: f.part,
          });
        }
      }
    }
    // Photo-only block fingers reuse the skin's hand texel.
    const fingers = new THREE.Group();
    const fingerMaterial = material.clone();
    const handFace = faces(props.skin.model).find(
      (f) => f.part === "leftArm" && f.layer === "base" && f.side === "front",
    )!;
    for (const direction of [-1, 1]) {
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 3.6, 1.1),
        fingerMaterial,
      );
      const uv = finger.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(
          i,
          (handFace.x + handFace.w / 2) / 64,
          1 - (handFace.y + handFace.h - 0.5) / 64,
        );
      finger.position.set(direction * 1.0, -7.5, 0);
      finger.rotation.z = direction * -0.3;
      fingers.add(finger);
    }
    fingers.position.y = -4;
    joints.get("leftArm")!.add(fingers);
    fingers.visible = false;
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
    let appliedPose = "";
    const vertex = new THREE.Vector3();
    const animate = () => {
      const p = latest.current;
      if (appliedPose !== p.pose) {
        const pose = POSES.find((item) => item.id === p.pose) ?? POSES[0];
        for (const [part, joint] of joints) {
          const angles = pose.rotations[part] ?? [0, 0, 0];
          joint.rotation.set(
            ...(angles.map(THREE.MathUtils.degToRad) as [
              number,
              number,
              number,
            ]),
          );
        }
        fingers.visible = !!pose.peace;
        fingers.rotation.x = THREE.MathUtils.degToRad(pose.elbows?.[1] ?? 0);
        body.rotation.y = THREE.MathUtils.degToRad(pose.turn ?? 0);
        for (const item of deformers) {
          const arm = item.part.endsWith("Arm");
          const bend = arm ? 4 : 6;
          const angle = THREE.MathUtils.degToRad(
            (arm ? pose.elbows : pose.knees)?.[
              item.part.startsWith("right") ? 0 : 1
            ] ?? 0,
          );
          const position = item.geometry.attributes.position;
          for (let i = 0; i < position.count; i++) {
            vertex.fromArray(item.original, i * 3).applyMatrix4(item.matrix);
            if (vertex.y < -bend) {
              const y = vertex.y + bend,
                z = vertex.z;
              vertex.y = y * Math.cos(angle) - z * Math.sin(angle) - bend;
              vertex.z = y * Math.sin(angle) + z * Math.cos(angle);
            }
            vertex.applyMatrix4(item.inverse);
            position.setXYZ(i, vertex.x, vertex.y, vertex.z);
          }
          position.needsUpdate = true;
          item.geometry.computeBoundingSphere();
          item.geometry.computeBoundingBox();
        }
        body.position.y = 0;
        body.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(body, true);
        body.position.y = -bounds.min.y + (pose.height ?? 0);
        body.updateMatrixWorld(true);
        appliedPose = p.pose;
      }
      for (const mesh of meshes) {
        const f = mesh.userData.face as Face;
        mesh.visible =
          (f.layer === "base" || p.outer || p.layer === "outer") &&
          (!p.isolate || p.parts.includes(f.part));
      }
      fingers.visible =
        !!POSES.find((item) => item.id === p.pose)?.peace &&
        (!p.isolate || p.parts.includes("leftArm"));
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
    props.captureRef.current = () => {
      const size = renderer.getSize(new THREE.Vector2());
      const pixelRatio = renderer.getPixelRatio();
      const visibility = grids.map((grid) => grid.visible);
      try {
        ground.visible = false;
        grids.forEach((grid) => {
          grid.visible = false;
        });
        // Keep the exact camera framing; output at twice the preview resolution.
        renderer.setPixelRatio(2);
        renderer.setSize(size.x, size.y, false);
        renderer.setClearColor(0x000000, 0);
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL("image/png");
      } finally {
        ground.visible = true;
        grids.forEach((grid, i) => {
          grid.visible = visibility[i];
        });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(size.x, size.y, false);
        renderer.render(scene, camera);
      }
    };
    return () => {
      props.captureRef.current = null;
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

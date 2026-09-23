import type { Part } from "./skin";

export interface Pose {
  id: string;
  label: string;
  rotations: Partial<Record<Part, [number, number, number]>>;
  elbows?: [number, number];
  peace?: boolean;
  turn?: number;
  knees?: [number, number];
  height?: number;
}

// Angles in degrees; limbs rotate around shoulders and hips.
export const POSES: Pose[] = [
  { id: "neutral", label: "Grundhaltung", rotations: {} },
  {
    id: "arms-up",
    label: "Arme hoch",
    rotations: { rightArm: [0, 0, -160], leftArm: [0, 0, 160] },
  },
  {
    id: "t-pose",
    label: "Arme seitlich",
    rotations: { rightArm: [0, 0, -90], leftArm: [0, 0, 90] },
  },
  {
    id: "reach",
    label: "Ein Arm nach vorne",
    rotations: { rightArm: [-90, 0, 0], head: [0, -12, 0] },
  },
  {
    id: "wave",
    label: "Winken",
    rotations: { leftArm: [0, 0, 150], head: [0, 0, -10] },
  },
  {
    id: "walk",
    label: "Gehen",
    rotations: {
      rightArm: [30, 0, 0],
      leftArm: [-30, 0, 0],
      rightLeg: [-30, 0, 0],
      leftLeg: [25, 0, 0],
    },
    knees: [10, 25],
  },
  {
    id: "run",
    label: "Laufen",
    rotations: {
      rightArm: [55, 0, -12],
      leftArm: [-65, 0, 12],
      rightLeg: [-65, 0, 0],
      leftLeg: [35, 0, 0],
    },
    knees: [35, 90],
  },
  {
    id: "squat",
    label: "Tiefe Hocke",
    rotations: {
      rightArm: [-80, 0, -10],
      leftArm: [-80, 0, 10],
      rightLeg: [-75, 0, 0],
      leftLeg: [-75, 0, 0],
    },
    knees: [135, 135],
  },
  {
    id: "crouch",
    label: "Breite Hocke",
    rotations: {
      rightArm: [-40, 0, -30],
      leftArm: [-40, 0, 30],
      rightLeg: [-55, 0, -22],
      leftLeg: [-55, 0, 22],
    },
    knees: [100, 100],
  },
  {
    id: "jump",
    label: "Freudensprung",
    rotations: {
      rightArm: [0, 0, -140],
      leftArm: [0, 0, 140],
      rightLeg: [-20, 0, -25],
      leftLeg: [15, 0, 25],
    },
    knees: [35, 65],
    height: 4,
  },
  {
    id: "peace",
    label: "Peace / V-Zeichen",
    rotations: {
      // Shoulder + elbow = -180°: the hand and V fingers point upward.
      leftArm: [-50, 0, 0],
      head: [0, -8, 12],
      rightLeg: [0, 0, -8],
    },
    elbows: [0, -130],
    peace: true,
  },
  {
    id: "head-tilt",
    label: "Kopf schräg",
    rotations: {
      head: [5, -12, -16],
      rightArm: [0, 0, -8],
      leftLeg: [-12, 0, 8],
    },
    knees: [0, 20],
  },
  {
    id: "shoulder-look",
    label: "Blick über die Schulter",
    turn: 65,
    rotations: {
      head: [5, -65, -8],
      leftArm: [-15, 0, 12],
      rightLeg: [-12, 0, 0],
    },
    knees: [15, 0],
  },
  {
    id: "dab",
    label: "Dab",
    rotations: {
      head: [18, -30, -12],
      rightArm: [-75, 0, 60],
      leftArm: [-15, 0, 115],
      leftLeg: [0, 0, 18],
    },
    elbows: [-85, 0],
  },
  {
    id: "shy",
    label: "Schüchtern",
    rotations: {
      head: [15, 15, -12],
      rightArm: [-30, 0, 12],
      leftArm: [-30, 0, -12],
      leftLeg: [-18, 0, -8],
    },
    elbows: [-100, -100],
    knees: [0, 25],
  },
  {
    id: "cheer",
    label: "Siegerpose",
    rotations: {
      head: [-10, 10, 8],
      rightArm: [0, 0, -145],
      leftArm: [0, 0, 35],
      leftLeg: [25, 0, 18],
    },
    elbows: [-25, -115],
    knees: [0, 85],
  },
];

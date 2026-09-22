import type { StyleProfile } from "./core/style-profile";
import type { GenerationRequest, GridPatch } from "./core/harness";
import type { PortraitDesign, FaceReview } from "../electron/portrait";
import type { Outfit } from "../electron/outfit";
export interface GenerationResult {
  styleProfile?: StyleProfile;
  rasterModel?: string;
  reasoningEffort?: string;
  pipeline?: "grid" | "image-grid";
  patch: GridPatch;
  elapsedMs: number;
  usage?: { input_tokens?: number; output_tokens?: number };
  provider: string;
  faceDraft?: string;
  imageModel?: string;
  imageUsage?: unknown;
  faceTransfer?: "vision-grid";
  portrait?: PortraitDesign;
  outfit?: Outfit;
  palette?: string[];
  faceReview?: FaceReview;
  beforeReview?: GridPatch;
  stages?: {
    name: string;
    elapsedMs: number;
    input_tokens?: number;
    output_tokens?: number;
    reasoning_tokens?: number;
  }[];
}
export interface DesktopBridge {
  onGenerationProgress?(
    listener: (stage: "analysis" | "image" | "grid" | "review") => void,
  ): () => void;
  keyStatus(): Promise<boolean>;
  saveKey(key: string): Promise<void>;
  deleteKey(): Promise<void>;
  generate(
    request: GenerationRequest,
    model: string,
  ): Promise<GenerationResult>;
  cancel(): Promise<void>;
  saveFile(
    kind: "png" | "pose" | "project" | "json",
    name: string,
    content: string,
  ): Promise<boolean>;
}
declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

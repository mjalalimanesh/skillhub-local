import { create } from "zustand";
import type { Agent, Skill, WSProgressEvent } from "@/lib/types";

const MAX_PROGRESS = 50;

interface AppState {
  agents: Agent[];
  skills: Skill[];
  selectedAgent: string | null;
  progress: WSProgressEvent[];
  wsConnected: boolean;

  setAgents: (agents: Agent[]) => void;
  setSkills: (skills: Skill[]) => void;
  setSelectedAgent: (id: string | null) => void;
  addProgress: (event: WSProgressEvent) => void;
  clearProgress: () => void;
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  agents: [],
  skills: [],
  selectedAgent: null,
  progress: [],
  wsConnected: false,

  setAgents: (agents) => set({ agents }),
  setSkills: (skills) => set({ skills }),
  setSelectedAgent: (id) => set({ selectedAgent: id }),
  addProgress: (event) =>
    set((state) => ({
      progress: [...state.progress.slice(-(MAX_PROGRESS - 1)), event],
    })),
  clearProgress: () => set({ progress: [] }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));

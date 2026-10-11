import { create } from 'zustand';
import type { RoomPlacement } from '@shared/schemas/room.js';
import { roomApi } from '../api/endpoints.js';

interface RoomPlacementState {
  childId: string | null;
  placements: RoomPlacement[] | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  load: (childId: string) => Promise<void>;
  save: (childId: string, placements: RoomPlacement[]) => Promise<void>;
  reset: () => void;
}

function emptyState(): Pick<RoomPlacementState, 'childId' | 'placements' | 'loading' | 'saving' | 'error'> {
  return { childId: null, placements: null, loading: false, saving: false, error: null };
}

export const useRoomPlacementStore = create<RoomPlacementState>((set, get) => ({
  ...emptyState(),
  load: async (childId) => {
    if (get().childId === childId && get().loading) return;
    set({ ...emptyState(), childId, loading: true });
    try {
      const placements = await roomApi.getPlacements(childId);
      if (get().childId !== childId) return;
      set({ placements, loading: false, error: null });
    } catch (error) {
      if (get().childId !== childId) return;
      set({ loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
  save: async (childId, placements) => {
    if (get().childId !== childId || get().saving) return;
    set({ saving: true, error: null });
    try {
      const saved = await roomApi.savePlacements(childId, placements);
      if (get().childId !== childId) return;
      set({ placements: saved, saving: false, error: null });
    } catch (error) {
      if (get().childId !== childId) return;
      set({ saving: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
  reset: () => set(emptyState()),
}));

export function __resetRoomPlacementStoreForTests(): void {
  useRoomPlacementStore.setState(emptyState());
}

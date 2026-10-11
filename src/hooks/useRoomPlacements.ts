import { useEffect } from 'react';
import type { RoomPlacement } from '@shared/schemas/room.js';
import { useActiveChild } from '../store/sessionStore.js';
import { useRoomPlacementStore } from '../store/roomPlacementStore.js';

export function useRoomPlacements(): {
  childId: string | null;
  placements: RoomPlacement[] | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  save: (placements: RoomPlacement[], targetChildId?: string) => Promise<void>;
  reload: () => Promise<void>;
} {
  const activeChild = useActiveChild();
  const childId = useRoomPlacementStore((state) => state.childId);
  const placements = useRoomPlacementStore((state) => state.placements);
  const isLoading = useRoomPlacementStore((state) => state.loading);
  const isSaving = useRoomPlacementStore((state) => state.saving);
  const error = useRoomPlacementStore((state) => state.error);
  const load = useRoomPlacementStore((state) => state.load);
  const saveToServer = useRoomPlacementStore((state) => state.save);
  const reset = useRoomPlacementStore((state) => state.reset);
  const reload = useRoomPlacementStore((state) => state.load);

  useEffect(() => {
    if (activeChild) void load(activeChild.id);
    else reset();
  }, [activeChild, load, reset]);

  return {
    childId,
    placements,
    isLoading,
    isSaving,
    error,
    save: async (next, targetChildId) => {
      if (activeChild && targetChildId === activeChild.id && childId === activeChild.id) {
        await saveToServer(activeChild.id, next);
      }
    },
    reload: async () => {
      if (activeChild) await reload(activeChild.id);
    },
  };
}

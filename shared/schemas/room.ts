import { z } from 'zod';

const placementSchema = z.object({
  itemId: z.string().trim().min(1).max(120),
  x: z.number().finite().min(0).max(100),
  y: z.number().finite().min(0).max(100),
  hidden: z.boolean(),
});

export const roomPlacementsSchema = z
  .array(placementSchema)
  .max(10)
  .refine((placements) => new Set(placements.map(({ itemId }) => itemId)).size === placements.length, {
    message: 'Trang trí không được lặp lại',
  });

export type RoomPlacement = z.infer<typeof placementSchema>;
export type RoomPlacements = z.infer<typeof roomPlacementsSchema>;

import type { FastifyInstance } from 'fastify';
import type { ApiOk, RoomPlacementsGetResponse, RoomPlacementsSaveRequest } from '../../shared/types/api.js';
import { roomPlacementsSchema } from '../../shared/schemas/room.js';
import { childIdFromParams } from '../lib/params.js';
import { requireParent, type AuthedRequest } from '../plugins/auth.js';
import { roomService } from '../services/RoomService.js';

export async function roomRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/children/:id/room/placements', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const body: ApiOk<RoomPlacementsGetResponse> = {
      data: roomService.getPlacements(authed.parent.id, childIdFromParams(req)),
    };
    return reply.send(body);
  });

  app.put('/api/children/:id/room/placements', { preHandler: requireParent }, async (req, reply) => {
    const authed = req as AuthedRequest;
    const input: RoomPlacementsSaveRequest = roomPlacementsSchema.parse(req.body);
    const body: ApiOk<RoomPlacementsGetResponse> = {
      data: roomService.savePlacements(authed.parent.id, childIdFromParams(req), input),
    };
    return reply.send(body);
  });
}

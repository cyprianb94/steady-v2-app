import { authedProcedure, router } from './trpc';
import type { ShoeRepo } from '../repos/shoe-repo';

export function createShoeRouter(shoeRepo: ShoeRepo) {
  return router({
    list: authedProcedure.query(async ({ ctx }) => {
      return shoeRepo.listByUserId(ctx.userId);
    }),
  });
}

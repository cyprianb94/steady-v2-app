/**
 * In-memory stores for dev mode.
 *
 * Shared across tRPC routers. Will be replaced with Supabase queries
 * once auth and persistence are wired up.
 */

import type { TrainingPlan } from '@steady/types';

export const planStore = new Map<string, TrainingPlan>();

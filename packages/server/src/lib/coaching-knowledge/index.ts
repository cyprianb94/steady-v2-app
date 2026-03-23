import { ADAPTATION_PHILOSOPHY } from './adaptation-philosophy';
import { INJURY_PREVENTION } from './injury-prevention';
import { TRAINING_METHODOLOGY } from './training-methodology';

/**
 * All coaching knowledge modules.
 *
 * To add new knowledge:
 * 1. Create a new .ts file in this directory
 * 2. Export a const string with the compressed coaching principle
 * 3. Import and add it to this array
 *
 * Keep each module focused on one topic.
 * The total is compressed before injection into the system prompt.
 */
export const COACHING_KNOWLEDGE = [
  ADAPTATION_PHILOSOPHY,
  INJURY_PREVENTION,
  TRAINING_METHODOLOGY,
] as const;

/**
 * Returns the full coaching knowledge as a single string,
 * suitable for injection into the system prompt.
 */
export function getCoachingKnowledge(): string {
  return COACHING_KNOWLEDGE.join('\n');
}

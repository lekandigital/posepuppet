// @bodyarcade/locomotion — public surface. See INTEGRATION.md for the V4
// integration contract (nav-graph hook, comfort parameters, coach copy).

export type {
  AssistMode, ComfortConfig, DeepPartial, LocomotionConfig, PathHint, WalkIntent,
  WalkMode, WalkPose,
} from './types';

export { createLocomotion } from './model';
export type { Locomotion, WalkEnvelope } from './model';

export { defaultLocomotionConfig, mergeLocomotionConfig } from './defaults';

export { createWalkController } from './controller';
export type {
  WalkController, WalkControllerOptions, WalkHudState, WalkTrackingHud,
} from './controller';

export { WALK_COACH, WALK_STATUS, coachLine } from './coach';

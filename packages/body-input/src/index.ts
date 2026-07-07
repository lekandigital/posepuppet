// @bodyarcade/body-input — public surface. Consumers pin the package
// version and check BodySignal.v at runtime; see README for the schema.

export type {
  AxisName, AxisShapingConfig, BodyAxes, BodyEvent, BodyInputConfig, BodyInputFrame,
  BodySignal, DeepPartial, EventConfig, ExtractionConfig, LandmarkPoint,
} from './types';

export { createBodyInputCore } from './pipeline';
export type { AxisDebug, BodyInputCore } from './pipeline';

export { defaultConfig, mergeConfig, AXIS_NAMES } from './defaults';

export {
  SCHEMA_V, AXIS_KEYS, EVENT_NAMES, TOP_KEYS,
  assertSignalShape, canonicalSignalJSON, canonicalStreamJSON, quantize,
} from './schema';

export {
  DEFAULT_CHANNEL, createBroadcastSink, createBroadcastSource, createInPageChannel,
} from './transport';
export type { BodySignalSink, BodySignalSource, TransportOptions } from './transport';

export {
  createInputRecorder, createSignalRecorder, replayInto, runTape, signalTapeJSON,
} from './tape';
export type { InputTape, SignalTape } from './tape';

export { AxisShaper, deadZone, expo } from './stages';
export { HoldToFire, ImpulseDetector } from './events';
export { OneEuro } from './oneEuro';
export type { NeutralState } from './extract';

/**
 * The one place the game names the camera application's source (../CAMERA/web/src).
 *
 * Type-only: everything here is erased at build time, so importing this file costs the
 * game nothing at runtime. The runtime classes are in `runtime.ts`, which is only ever
 * loaded with a dynamic `import()` once a person turns the camera on.
 *
 * The camera app is imported in place, never copied: its vision pipeline, transport and
 * wire types stay single-sourced, and the standalone app (CAMERA/web) keeps working on
 * the same files for debugging.
 */

export type {
  CalibrationStatus,
  DerivedState,
  GameEventInput,
  GameEventType,
  Gesture,
  GestureEventMessage,
  Measurement,
  ObservationBody,
  PerfInfo,
  SuggestedActionMessage,
  TaskOutcome,
  TrackingStatus
} from '../../../CAMERA/web/src/protocol/types.ts'
export type {
  AdapterState,
  ConnectionStatus,
  ConnectionStatusEvent,
  GameAdapterApi,
  ProducerConnectionApi,
  Unsubscribe
} from '../../../CAMERA/web/src/transport/contracts.ts'
export type {
  FaceObserverApi,
  ObserverStatus,
  ProcessorStatus
} from '../../../CAMERA/web/src/vision/contracts.ts'
export type { CreateSessionResponse } from '../../../CAMERA/web/src/protocol/types.ts'

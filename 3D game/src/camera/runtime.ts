/**
 * The camera application's runtime classes, re-exported from ../CAMERA/web/src.
 *
 * Only loaded through `import('./runtime')` when the camera is turned on, so with the
 * camera off the game downloads none of it — no transport, no MediaPipe, no worker.
 */

export { createSession, deleteSession } from '../../../CAMERA/web/src/transport/session.ts'
export { GameAdapter } from '../../../CAMERA/web/src/transport/GameAdapter.ts'
export { ProducerConnection } from '../../../CAMERA/web/src/transport/ProducerConnection.ts'
export { FaceObserver } from '../../../CAMERA/web/src/vision/FaceObserver.ts'

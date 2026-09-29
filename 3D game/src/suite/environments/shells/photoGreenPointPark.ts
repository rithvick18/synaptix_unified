/** Green Point Park, Cape Town, Greg Zaal / Poly Haven, CC0. Captured park panorama. */
import { photoShell } from './photo'
import type { SlotDef } from './types'

const slots: SlotDef[] = [
  { id: 'lawn', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [2, 0.5, 2], photoHotspot: { u: 0.5, v: 0.68, width: 0.8, height: 0.55 } },
  { id: 'mountains', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [1.5, 1, 0.1], photoHotspot: { u: 0.82, v: 0.46, width: 0.8, height: 0.45 } }
]

export const photoGreenPointPark = photoShell({
  id: 'photoGreenPointPark', name: { en: 'Green Point Park · Cape Town' }, slots,
  panorama: { display: 'assets/panoramas/green-point-park.webp', lighting: 'assets/panoramas/green-point-park_1k.hdr',
    cameraHeight: 1.5, yaw: 0, radius: 12 },
  parallax: 0.18, floor: [-4, -4, 4, 4], target: [0, 1.0, -3]
})

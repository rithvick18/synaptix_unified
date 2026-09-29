/** Spiaggia di Mondello, Andreas Mischok / Poly Haven, CC0. Captured beach panorama. */
import { photoShell } from './photo'
import type { SlotDef } from './types'

const slots: SlotDef[] = [
  { id: 'shore', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [2, 0.5, 2], photoHotspot: { u: 0.52, v: 0.66, width: 0.8, height: 0.55 } },
  { id: 'water', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [1.5, 1, 0.1], photoHotspot: { u: 0.3, v: 0.53, width: 0.8, height: 0.45 } },
  { id: 'pines', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [1.5, 1, 0.1], photoHotspot: { u: 0.74, v: 0.42, width: 0.8, height: 0.5 } }
]

export const photoMondelloBeach = photoShell({
  id: 'photoMondelloBeach', name: { en: 'Mondello Beach · Sicily' }, slots,
  panorama: { display: 'assets/panoramas/mondello-beach.webp', lighting: 'assets/panoramas/mondello-beach_1k.hdr',
    cameraHeight: 1.5, yaw: 0, radius: 12 },
  parallax: 0.18, floor: [-4, -4, 4, 4], target: [0, 1.0, -3]
})

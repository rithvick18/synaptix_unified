/** Combination Room, Sergej Majboroda / Poly Haven, CC0. All objects are in the capture. */
import { photoShell } from './photo'
import type { SlotDef } from './types'

const slots: SlotDef[] = [
  { id: 'sofa', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [2.1, 0.9, 0.9], photoHotspot: { u: 0.285, v: 0.675, width: 0.95, height: 0.6 } },
  { id: 'lamp', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [0.55, 1.6, 0.55], photoHotspot: { u: 0.435, v: 0.61, width: 0.4, height: 0.78 } },
  { id: 'armchair', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [0.85, 1, 0.85], photoHotspot: { u: 0.885, v: 0.68, width: 0.65, height: 0.62 } },
  { id: 'picture', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [0.7, 0.55, 0.08], photoHotspot: { u: 0.365, v: 0.45, width: 0.52, height: 0.42 } }
]

export const photoCombination = photoShell({
  id: 'photoCombination', name: { en: 'Traditional sitting room' }, slots,
  panorama: { display: 'assets/panoramas/combination-room.webp', lighting: 'assets/panoramas/combination-room_1k.hdr',
    cameraHeight: 1.5, yaw: 2 * Math.PI * (0.6 - 0.5), radius: 7 },
  parallax: 0.15, floor: [-3, -3, 3, 3], target: [-2.2, 1.15, 0.25]
})

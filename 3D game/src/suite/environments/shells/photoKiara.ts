/** Kiara Interior, Greg Zaal / Poly Haven, CC0. All objects are in the capture. */
import { photoShell } from './photo'
import type { SlotDef } from './types'

const slots: SlotDef[] = [
  { id: 'sofa', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [2.1, 0.95, 0.9], photoHotspot: { u: 0.62, v: 0.59, width: 1.0, height: 0.58 } },
  { id: 'television', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [0.8, 1.17, 0.55], photoHotspot: { u: 0.277, v: 0.51, width: 0.55, height: 0.5 } },
  { id: 'fridge', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [0.9, 1.9, 0.8], photoHotspot: { u: 0.821, v: 0.52, width: 0.65, height: 0.86 } },
  { id: 'chair', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [0.85, 1, 0.85], photoHotspot: { u: 0.115, v: 0.59, width: 0.48, height: 0.62 } },
  { id: 'mug', mount: 'surface', position: [0, 0, 0], yaw: 0, maxSize: [0.12, 0.12, 0.12], photoHotspot: { u: 0.66, v: 0.715, width: 0.24, height: 0.24 } }
]

export const photoKiara = photoShell({
  id: 'photoKiara', name: { en: 'Kitchen and lounge' }, slots,
  panorama: { display: 'assets/panoramas/kiara-interior.webp', lighting: 'assets/panoramas/kiara-interior_1k.hdr',
    cameraHeight: 1.5, yaw: 2 * Math.PI * (0.61 - 0.5), radius: 7 },
  parallax: 0.15, floor: [-3, -3, 3, 3], target: [0, 1.2, -2.2]
})

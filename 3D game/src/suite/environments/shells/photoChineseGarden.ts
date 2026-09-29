/** Chinese Garden, Andreas Mischok / Poly Haven, CC0. Captured garden panorama. */
import { photoShell } from './photo'
import type { SlotDef } from './types'

const slots: SlotDef[] = [
  { id: 'pond', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [2, 0.5, 2], photoHotspot: { u: 0.53, v: 0.64, width: 0.7, height: 0.55 } },
  { id: 'pavilion', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [1.5, 2, 0.2], photoHotspot: { u: 0.76, v: 0.5, width: 0.75, height: 0.75 } },
  { id: 'garden-trees', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [1.5, 2, 0.2], photoHotspot: { u: 0.12, v: 0.31, width: 0.8, height: 0.55 } }
]

export const photoChineseGarden = photoShell({
  id: 'photoChineseGarden', name: { en: 'Chinese garden' }, slots,
  panorama: { display: 'assets/panoramas/chinese-garden.webp', lighting: 'assets/panoramas/chinese-garden_1k.hdr',
    cameraHeight: 1.5, yaw: 2 * Math.PI * (0.53 - 0.5), radius: 12 },
  parallax: 0.18, floor: [-4, -4, 4, 4], target: [-0.3, 1.05, -2.5]
})

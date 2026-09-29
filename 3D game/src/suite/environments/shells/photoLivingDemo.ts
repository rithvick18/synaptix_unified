/**
 * Lythwood Room by Greg Zaal, Poly Haven (CC0). Interactive targets are real objects
 * already visible in the capture. No synthetic furniture is drawn over the photograph.
 *
 * Measured against the photograph (tools/suite/assets/preview.html?shell=photoLivingDemo
 * &grid=1&slots=1): the seat faces the wall with the dressing table, 2.33 m away and square
 * to the view (−z); the wall with the white door and the beds' headboards is on the left at
 * x ≈ −3.05, the wardrobe on the right from x ≈ 0.2. The clear carpet between them is where
 * the objects stand. The photograph's main light is the window to the seat's right.
 */
import { photoShell } from './photo'
import type { SlotDef } from './types'

const slots: SlotDef[] = [
  { id: 'television', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [0.8, 1.17, 0.55], photoHotspot: { u: 0.724, v: 0.545, width: 0.7, height: 0.55 } },
  { id: 'lamp', mount: 'surface', position: [0, 0, 0], yaw: 0, maxSize: [0.3, 0.45, 0.3], photoHotspot: { u: 0.366, v: 0.541, width: 0.32, height: 0.55 } },
  { id: 'mirror', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [0.51, 0.71, 0.04], photoHotspot: { u: 0.336, v: 0.532, width: 0.38, height: 0.55 } },
  { id: 'picture', mount: 'wall', position: [0, 0, 0], yaw: 0, maxSize: [0.3, 0.38, 0.025], photoHotspot: { u: 0.835, v: 0.438, width: 0.38, height: 0.4 } },
  { id: 'tea-table', mount: 'floor', position: [0, 0, 0], yaw: 0, maxSize: [1, 0.42, 0.55], photoHotspot: { u: 0.718, v: 0.662, width: 0.65, height: 0.48 } }
]

export const photoLivingDemo = photoShell({
  id: 'photoLivingDemo',
  name: { en: 'Lythwood room', hi: 'लिथवुड का कमरा' },
  slots,
  panorama: {
    display: 'assets/panoramas/lythwood-room.webp',
    lighting: 'assets/panoramas/lythwood-room_1k.hdr',
    cameraHeight: 1.38,
    // Image column 1487 of 4096 (the dressing-table wall's nearest point) straight ahead.
    yaw: 2 * Math.PI * (1487 / 4096 - 0.5),
    exposure: 1,
    // The window, at column ≈2480: soft overcast light from the right and a little above.
    key: { azimuth: 1.52, elevation: 0.6, intensity: 1.2, softness: 6 },
    radius: 7
  },
  parallax: 0.2,
  // The clear carpet in front of the seat, short of the walls, the bed and the wardrobe.
  floor: [-3.0, -2.3, 0.15, -0.35],
  target: [-1.35, 0.9, -2.3]
})

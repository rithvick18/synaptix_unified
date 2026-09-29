import type { ShellId } from '../../contracts'
import { courtyardVeranda } from './courtyardVeranda'
import { kitchenDining } from './kitchenDining'
import { livingRoom } from './livingRoom'
import { photoLivingDemo } from './photoLivingDemo'
import { photoCombination } from './photoCombination'
import { photoKiara } from './photoKiara'
import { photoChineseGarden } from './photoChineseGarden'
import { photoGreenPointPark } from './photoGreenPointPark'
import { photoMondelloBeach } from './photoMondelloBeach'
import type { ShellDef } from './types'

export const SHELL_DEFS: Readonly<Record<ShellId, ShellDef>> = { livingRoom, kitchenDining, courtyardVeranda, photoLivingDemo, photoCombination, photoKiara, photoChineseGarden, photoGreenPointPark, photoMondelloBeach }

export type { ShellDef, SlotDef, ShellBuild } from './types'
export { photoShell, panoramaDirection, panoramaFloorPoint, type PhotoShellConfig, type PanoramaConfig } from './photo'

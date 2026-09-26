import type { ShellId } from '../../contracts'
import { courtyardVeranda } from './courtyardVeranda'
import { kitchenDining } from './kitchenDining'
import { livingRoom } from './livingRoom'
import type { ShellDef } from './types'

export const SHELL_DEFS: Readonly<Record<ShellId, ShellDef>> = { livingRoom, kitchenDining, courtyardVeranda }

export type { ShellDef, SlotDef, ShellBuild } from './types'

/**
 * The procedural builder registry. A manifest entry with `source.kind: 'procedural'` names
 * one of these keys in `source.builder`; `source.params` are passed through.
 *
 * Every builder returns an Object3D with its origin at the base centre, +Z the front,
 * units in metres.
 */
import type { Builder } from '../kit'
import * as furniture from './furniture'
import * as keepsakes from './keepsakes'
import * as kitchen from './kitchen'
import * as media from './media'
import * as misc from './misc'
import * as plants from './plants'
import * as school from './school'
import * as storage from './storage'
import * as textiles from './textiles'

export const BUILDERS: Readonly<Record<string, Builder>> = {
  ...keepsakes,
  ...furniture,
  ...storage,
  ...textiles,
  ...kitchen,
  ...plants,
  ...media,
  ...school,
  ...misc
}

export function hasBuilder(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILDERS, key)
}

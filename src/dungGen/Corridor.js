import { simpleGetProxy } from "../helpers/proxy.js";
import { buildCellKey } from "../dungGen/Generator.js"

let currentMaxId = 0

export function Corridor(nodes) {
  const cells = nodes
  return {
    cells: simpleGetProxy(cells),
    addCell: (coords) => cells[buildCellKey(coords)] = coords,
    coordsAreInside: (coords) => !!cells[buildCellKey(coords)]
  }
}
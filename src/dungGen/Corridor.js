import { simpleGetProxy } from "../helpers/proxy.js";
import { buildCellKey, getNewDirectionClockWise, getNewCoordsInDirection } from "../helpers/helpers.js";

let currentMaxId = 0

export function Corridor(data) {
  currentMaxId++
  const cells = data.cells
  const start = data.start

  this.id = `corr-${currentMaxId}`
  this.cells = simpleGetProxy(cells)
  this.start = simpleGetProxy(start)
  this.passages = {}
  this.addCell = (coords) => cells[buildCellKey(coords)] = coords
  this.isInside = (coords) => !!cells[buildCellKey(coords)]
  this.walkCorridor = (cellDirectionCallback) => {
    const uncheckedCells = { ...cells }
    let currentCell = start
    let direction = [1, 0]
    let nextCell

    while (currentCell) {
      let d = 0
      while (
        (!nextCell || !this.isInside(nextCell) || !uncheckedCells[buildCellKey(nextCell)])
        && d < 4) {
        direction = getNewDirectionClockWise(direction)
        nextCell = getNewCoordsInDirection(currentCell, direction)
        d++
      }

      if (nextCell && this.isInside(nextCell)) {
        currentCell = nextCell
        delete uncheckedCells[buildCellKey(nextCell)]
        cellDirectionCallback(currentCell, direction)
      } else {
        currentCell = undefined
      }
    }

    const lastCells = Object.values(uncheckedCells)
    if (lastCells.length > 0) {
      lastCells.forEach((c) => {
        let nearestCell
        for (let i = 0; i < 4; i++) {
          direction = getNewDirectionClockWise(direction)
          nearestCell = getNewCoordsInDirection(c, direction)
          if (this.isInside(nearestCell)) break
        }
        cellDirectionCallback(c, direction)
      })
    }
  }
  this.doForAllCoordsInside = (callback) =>
    Object.values(cells).forEach((c) => callback(c))
  return this
}
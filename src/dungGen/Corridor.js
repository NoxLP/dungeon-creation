import { simpleGetProxy } from "../helpers/proxy.js";
import { coordsEqual, buildCellKey, getNewDirectionClockWise, getNewCoordsInDirection } from "../helpers/helpers.js";

let currentMaxId = 0

export function Corridor(data) {
  currentMaxId++
  const cells = data.cells
  const start = data.start

  this.start = data.start
  this.id = `corr-${currentMaxId}`
  this.cells = simpleGetProxy(cells)
  this.start = simpleGetProxy(start)
  this.passages = {}

  this.addCell = (coords) => {
    cells[buildCellKey(coords)] = coords
    this.cells = simpleGetProxy(cells)
  }
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
  this.hasMoreThanNumberNeighboursInside = (coords, number) => {
    let direction = [1, 0]
    let directionsWithCorridorCell = 0
    let currentNeighbour
    for (let i = 0; i < 4; i++) {
      currentNeighbour = getNewCoordsInDirection(coords, direction, 1)
      if (this.isInside(currentNeighbour)) ++directionsWithCorridorCell
      if (directionsWithCorridorCell > number) return true
      direction = getNewDirectionClockWise(direction)
    }
    return false
  }
  this.doForAllCoordsInside = (callback) =>
    Object.values(cells).forEach((c) => callback(c))
  this.removeCell = (coords) => {
    const key = buildCellKey(coords)
    delete cells[key]
    this.cells = simpleGetProxy(cells)
    if (this.passages[key])
      delete this.passages[key]
    if (this.deadEnds[key])
      delete this.passages[key]
  }
  this.findNeighboursInsideFirstInDirection = (coords, direction) => {
    if (!this.isInside(coords)) {
      console.error('NOT in corridor')
      return undefined
    }

    const neighbours = []
    let currentNeighbour
    for (let i = 0; i < 4; i++) {
      currentNeighbour = getNewCoordsInDirection(coords, direction)
      if (this.isInside(currentNeighbour)) neighbours.push(currentNeighbour)
      direction = getNewDirectionClockWise(direction)
    }

    return neighbours
  }
  this.isAPassage = (coords) =>
    Object.values(this.passages).some((p) => coordsEqual(p.cell, coords))

  return this
}
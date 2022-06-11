import { coordsEqual } from "../helpers/helpers.js";
import { simpleGetProxy } from "../helpers/proxy.js";

let currentMaxId = 0

export function Room(topLeft, bottomRight) {
  if (!topLeft
    || !bottomRight
    || !Array.isArray(topLeft)
    || !Array.isArray(bottomRight)
    || topLeft.length != 2
    || bottomRight.length != 2)
    throw new Error('Bad room coordinates')

  const topLeftCoords = topLeft
  const bottomRightCoords = bottomRight

  this.id = `room-${currentMaxId}`
  currentMaxId++
  this.topLeft = simpleGetProxy(topLeftCoords)
  this.topRight = simpleGetProxy([bottomRightCoords[0], topLeftCoords[1]])
  this.bottomRight = simpleGetProxy(bottomRightCoords)
  this.bottomLeft = simpleGetProxy([topLeftCoords[0], bottomRightCoords[1]])
  this.center = simpleGetProxy([
    Math.floor((bottomRightCoords[0] - topLeftCoords[0]) / 2) + topLeftCoords[0],
    Math.floor((bottomRightCoords[1] - topLeftCoords[1]) / 2) + topLeftCoords[1],
  ])
  this.width = this.topRight[0] - this.topLeft[0]
  this.height = this.bottomLeft[1] - this.topLeft[1]
  this.passages = {}

  this.xMax = bottomRightCoords[0]
  this.xMin = topLeftCoords[0]
  this.yMax = bottomRightCoords[1]
  this.yMin = topLeftCoords[1]
  this.isInside = (coords) =>
    coords[0] >= topLeftCoords[0] && coords[0] <= bottomRightCoords[0]
    && coords[1] >= topLeftCoords[1] && coords[1] <= bottomRightCoords[1]
  this.doForAllCoordsInside = (callback) => {
    for (let i = topLeftCoords[0]; i <= bottomRightCoords[0]; i++) {
      for (let j = topLeftCoords[1]; j < bottomRightCoords[1]; j++) {
        callback([i, j])
      }
    }
  }
  this.roomOverlap = (other) =>
    this.xMax >= other.xMin &&
    other.xMax >= this.xMin &&
    this.yMax >= other.yMin &&
    other.yMax >= this.yMin
  this.distanceXTo = (other) => this.xMax - other.xMin
  this.distanceYTo = (other) => this.yMax - other.yMin
  this.isInMargin = (coords) =>
    (
      coords[1] <= this.yMax
      && coords[1] >= this.yMin
      && (
        this.xMax + 1 == coords[0]
        || this.xMin - 1 == coords[0]
      )
    ) || (
      coords[0] <= this.xMax
      && coords[0] >= this.xMin
      && (
        this.yMax + 1 == coords[1]
        || this.yMin - 1 == coords[1]
      )
    ) || (
      this.xMin - 1 == coords[0]
      && this.yMin - 1 == coords[1]
    ) || (
      this.xMax + 1 == coords[0]
      && this.yMin - 1 == coords[1]
    ) || (
      this.xMax + 1 == coords[0]
      && this.yMax + 1 == coords[1]
    ) || (
      this.xMin - 1 == coords[0]
      && this.yMax + 1 == coords[1]
    )
  this.isMarginCorner = (coords) =>
    (
      this.xMin - 1 == coords[0]
      && this.yMin - 1 == coords[1]
    ) || (
      this.xMax + 1 == coords[0]
      && this.yMin - 1 == coords[1]
    ) || (
      this.xMax + 1 == coords[0]
      && this.yMax + 1 == coords[1]
    ) || (
      this.xMin - 1 == coords[0]
      && this.yMax + 1 == coords[1]
    )
  this.isAPassage = (coords) =>
    Object.values(this.passages).some((p) => coordsEqual(p.cell, coords))

  return this
}

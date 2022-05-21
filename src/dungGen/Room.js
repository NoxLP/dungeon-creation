import { simpleGetProxy } from "../helpers/proxy.js";

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

  this.topLeft = simpleGetProxy(topLeftCoords)
  this.topRight = simpleGetProxy([bottomRightCoords[0], topLeftCoords[1]])
  this.bottomRight = simpleGetProxy(bottomRightCoords)
  this.bottomLeft = simpleGetProxy([topLeftCoords[0], bottomRightCoords[1]])

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

  return this
}

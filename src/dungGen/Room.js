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

  this.id = currentMaxId
  currentMaxId++
  this.topLeft = simpleGetProxy(topLeftCoords)
  this.topRight = simpleGetProxy([bottomRightCoords[0], topLeftCoords[1]])
  this.bottomRight = simpleGetProxy(bottomRightCoords)
  this.bottomLeft = simpleGetProxy([topLeftCoords[0], bottomRightCoords[1]])
  this.center = simpleGetProxy([
    Math.floor((bottomRightCoords[0] - topLeftCoords[0]) / 2) + topLeftCoords[0],
    Math.floor((bottomRightCoords[1] - topLeftCoords[1]) / 2) + topLeftCoords[1],
  ])

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
  this.roomOverlap = (other) => {
    const thisMinMax = this.getMinMaxCoords()
    const otherMinMax = other.getMinMaxCoords()

    return thisMinMax.xMax >= otherMinMax.xMin &&
      otherMinMax.xMax >= thisMinMax.xMin &&
      thisMinMax.yMax >= otherMinMax.yMin &&
      otherMinMax.yMax >= thisMinMax.yMin
  }
  this.distanceXTo = (other) => {
    const thisMinMax = this.getMinMaxCoords()
    const otherMinMax = other.getMinMaxCoords()
    return thisMinMax.xMax - otherMinMax.xMin
  }
  this.distanceYTo = (other) => {
    const thisMinMax = this.getMinMaxCoords()
    const otherMinMax = other.getMinMaxCoords()
    return thisMinMax.yMax - otherMinMax.yMin
  }
  this.getMinMaxCoords = () => ({
    xMax: bottomRightCoords[0],
    xMin: topLeftCoords[0],
    yMax: bottomRightCoords[1],
    yMin: topLeftCoords[1],
  })

  return this
}

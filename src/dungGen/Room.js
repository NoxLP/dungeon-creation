export class Room {
  _topLeftCoords;
  _bottomRightCoords;

  constructor(topLeft, bottomRight) {
    if (!topLeft
      || !bottomRight
      || !Array.isArray(topLeft)
      || !Array.isArray(bottomRight)
      || topLeft.length != 2
      || bottomRight.length != 2)
      throw new Exception('Bad room coordinates')
    this._topLeftCoords = topLeft
    this._bottomRightCoords = bottomRight
  }

  get topLeft() {
    return simpleGetProxy(this._topLeftCoords)
  }
  get bottomRight() {
    return simpleGetProxy(this._bottomRightCoords)
  }

  coordsAreInside(coords) {
    return coords[0] >= this._topLeftCoords[0] && coords[0] <= this._bottomRightCoords[0]
      && coords[1] >= this._topLeftCoords[1] && coords[1] <= this._bottomRightCoords[1]
  }
}
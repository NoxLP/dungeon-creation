import { randomBetweenRange } from "../helpers/random.js";
import { simpleGetProxy } from "../helpers/proxy.js";
import { Room } from "./Room.js";

export class Generator {
  _containerWidth;
  _containerHeight;
  _roomMaxSize;
  _roomMinSize;
  _rooms;
  _cells;

  constructor(width, height, config) {
    this._containerWidth = width
    this._containerHeight = height

    if (config) {
      if (config.roomMaxSize) this._roomMaxSize = config.roomMaxSize
      if (config.roomMinSize) this._roomMinSize = config.roomMinSize
    } else {
      this._roomMaxSize = [15, 15]
      this._roomMinSize = [5, 5]
    }

    this._rooms = [new Room([0, 0], [10, 10]), new Room([15, 15], [20, 20])]
    this._cells = []
  }

  get rooms() {
    return simpleGetProxy(this._rooms)
  }

  generate() {

  }

  generateRooms() {
    // let stop = false;
    // let currentHeight, currentWidth

    // while (!stop) {
    //   currentHeight = Math.floor(randomBetweenRange(this._roomMinSize[0], this._roomMaxSize[0]))
    //   currentWidth = Math.floor(randomBetweenRange(this._roomMinSize[1], this._roomMaxSize[1]))


    // }
  }

  isInsideSomeRoom(coords) {
    return this._rooms.some((r) => r.isInside(coords))
  }
}
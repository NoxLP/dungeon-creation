import { Room } from "./Room.js";
import { intRandomBetweenRange } from "../helpers/random.js";
import { simpleGetProxy } from "../helpers/proxy.js";

// yeah, I could use classes... I wouldn't have private members and
// I don't need typescript
export function Generator(width, height, config) {
  // ****************** private fields
  const containerWidth = width;
  const containerHeight = height;
  const roomMaxSize = !config
    ? [30, 30]
    : config.roomMaxSize
      ? config.roomMaxSize
      : [30, 30];
  const roomMinSize = !config
    ? [15, 15]
    : config.roomMinSize
      ? config.roomMinSize
      : [15, 15];
  const rooms = [];
  const emptyCells = {};
  const roomCells = {};

  // ****************** public fields
  this.rooms = simpleGetProxy(rooms)

  // ****************** private methods
  const buildCellKey = (...coords) => `${coords[0]},${coords[1]}`
  const isInsideARoom = (coords) => buildCellKey(coords) in roomCells
  const addRoom = (room) => {
    rooms.push(room)
    room.doForAllCoordsInside((coords) => {
      const coordKey = buildCellKey(coords)
      if (coordKey in emptyCells) delete emptyCells[coordKey]
      roomCells[coordKey] = true
    })
  }
  const cornersAreInsideARoom = (coords, width, height) => {
    return isInsideARoom(coords) || //topleft
      isInsideARoom([coords[0] + width, coords[1]]) || //topright
      isInsideARoom([coords[0] + width, coords[1] + height]) || //botright
      isInsideARoom([coords[0], coords[1] + height]) //botleft
  }
  const createRoomNotInsideSomeRoom = (width, height) => {
    let coords
    let tries = 0

    while (tries < 10) {
      tries++
      coords = [
        intRandomBetweenRange(0, containerWidth),
        intRandomBetweenRange(0, containerHeight)
      ]
      if (!cornersAreInsideARoom(coords, width, height))
        return new Room(coords, [coords[0] + width, coords[1] + height])
    }

    return null
  }
  const generateRooms = (maxRooms) => {
    const testedHeights = {}
    const testedWidths = {}
    let badTries = 0

    while (rooms.length < maxRooms && badTries < 10) {
      const currentRoomWidth = intRandomBetweenRange(
        roomMinSize[0],
        roomMaxSize[0],
        testedWidths
      )
      const currentRoomHeight = intRandomBetweenRange(
        roomMinSize[1],
        roomMaxSize[1],
        testedHeights
      )

      const room = createRoomNotInsideSomeRoom(currentRoomWidth, currentRoomHeight)
      if (!room) {
        badTries++
        continue
      }

      addRoom(room)
      badTries = 0
    }
  }
  // ******************

  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      emptyCells[buildCellKey(i, j)] = true
    }
  }

  generateRooms(10)

  return this
}

import { Room } from "./Room.js";
import { intRandomBetweenRange } from "../helpers/random.js";
import { simpleGetProxy } from "../helpers/proxy.js";

const ROOM_MAX_SIZE = [20, 20]
const ROOM_MIN_SIZE = [10, 10]

// yeah, I could use classes... I wouldn't have private members and
// I don't need typescript
export function Generator(width, height, config) {
  // ****************** private fields
  const containerWidth = width;
  const containerHeight = height;
  const roomMaxSize = !config
    ? ROOM_MAX_SIZE
    : config.roomMaxSize
      ? config.roomMaxSize
      : ROOM_MAX_SIZE;
  const roomMinSize = !config
    ? ROOM_MIN_SIZE
    : config.roomMinSize
      ? config.roomMinSize
      : ROOM_MIN_SIZE;
  const rooms = [];
  const emptyCells = {};
  const roomCells = {};

  // ****************** public fields
  this.rooms = simpleGetProxy(rooms)
  this.emptyCells = simpleGetProxy(emptyCells)
  this.roomCells = simpleGetProxy(roomCells)

  // ****************** private methods
  const coordsAreInsideMap = (coords) =>
    coords[0] > 0 && coords[0] < containerWidth
    && coords[1] > 0 && coords[1] < containerHeight
  const buildCellKey = (coords) => `${coords[0]},${coords[1]}`
  const isInsideARoom = (coords) => buildCellKey(coords) in roomCells
  const addRoom = (room) => {
    rooms.push(room)
    room.doForAllCoordsInside((coords) => {
      const coordKey = buildCellKey(coords)
      if (coordKey in emptyCells) delete emptyCells[coordKey]
      roomCells[coordKey] = true
    })
  }
  // const cornersAreInsideARoom = (coords, width, height) => {
  //   return isInsideARoom(coords) || //topleft
  //     isInsideARoom([coords[0] + width, coords[1]]) || //topright
  //     isInsideARoom([coords[0] + width, coords[1] + height]) || //botright
  //     isInsideARoom([coords[0], coords[1] + height]) //botleft
  // }
  const someRoomOverlap = (room) => rooms.some((r) => room.roomOverlap(r))

  const createRoomNotInsideSomeRoom = (width, height) => {
    let coords
    let tries = 0

    while (tries < 10) {
      tries++
      coords = [
        intRandomBetweenRange(0, containerWidth),
        intRandomBetweenRange(0, containerHeight)
      ]

      const bottomRightCoords = [coords[0] + width, coords[1] + height]
      if (!coordsAreInsideMap(bottomRightCoords)) continue

      const room = new Room(coords, bottomRightCoords)
      if (someRoomOverlap(room)) continue

      return room
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

  for (let i = 0; i < containerWidth; i++) {
    for (let j = 0; j < containerHeight; j++) {
      emptyCells[buildCellKey(i, j)] = true
    }
  }

  generateRooms(10)

  return this
}

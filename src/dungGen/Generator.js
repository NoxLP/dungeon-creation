import { Room } from "./Room.js";
import { intRandomBetweenRange } from "../helpers/random.js";
import { simpleGetProxy } from "../helpers/proxy.js";

const ROOM_MAX_SIZE = [20, 20]
const ROOM_MIN_SIZE = [10, 10]
const MIN_SPACE_BETWEEN_ROOMS = 0

// yeah, I could use classes... I wouldn't have private members and
// I don't need typescript
export async function Generator(width, height, config, finishCallback) {
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
  const rooms = {};
  const emptyCells = {};
  const roomCells = {};
  const maxTries = config.maxTries || containerWidth * containerHeight * 0.25
  console.log('MAXTRIES: ', maxTries);
  const minSpaceBetweenRooms = !config
    ? MIN_SPACE_BETWEEN_ROOMS
    : config.minSpaceBetweenRooms
      ? config.minSpaceBetweenRooms
      : MIN_SPACE_BETWEEN_ROOMS

  // ****************** private methods
  const coordsAreInsideMap = (coords) =>
    coords[0] > 0 && coords[0] < containerWidth
    && coords[1] > 0 && coords[1] < containerHeight
  const buildCellKey = (coords) => `${coords[0]},${coords[1]}`
  const getCoordsFromKey = (key) => {
    const match = key.match(/^(\d+),(\d+)/)
    if (match) return [parseInt(match[1]), parseInt(match[2])]
    return null
  }
  const addRoom = (room) => {
    rooms[room.id] = room
    room.doForAllCoordsInside((coords) => {
      const coordKey = buildCellKey(coords)
      if (coordKey in emptyCells) delete emptyCells[coordKey]
      roomCells[coordKey] = true
    })
  }
  const someRoomOverlap = (room) => Object.values(rooms).some((r) => room.roomOverlap(r))
  const coordsAreInARoom = (coords) => roomCells[buildCellKey(coords)]
  const locateNearRooms = async (room, distance) => {
    const roomCoords = {
      tl: [...room.topLeft],
      tr: [...room.topRight],
      bl: [...room.bottomLeft],
      br: [...room.bottomRight],
    }
    const sumRoomCoords = () => {
      roomCoords.tl[0]--
      roomCoords.tl[1]--
      roomCoords.tr[0]++
      roomCoords.tr[1]--
      roomCoords.bl[0]--
      roomCoords.bl[1]++
      roomCoords.br[0]++
      roomCoords.br[1]++
    }
    const foundRooms = {}
    const findRoomInLineAsync = async (firstPoint, secondPoint, horizontal) => {
      let start, end, currentCoords, buildCoords
      if (horizontal) {
        start = firstPoint[0]
        end = secondPoint[0] + 1
        buildCoords = (i) => ([i, firstPoint[1]])
      } else {
        start = firstPoint[1]
        end = secondPoint[1] + 1
        buildCoords = (i) => ([firstPoint[0], i])
      }

      for (let i = start; i < end; i++) {
        currentCoords = buildCoords(i)
        if (coordsAreInARoom(currentCoords)) {
          const room = Object(values).find((r) => r.isInside(currentCoords))
          if (room && !foundRooms[room.id])
            foundRooms[room.id] = room
        }
      }
    }
    let currentDistance = 0

    while (currentDistance <= distance) {
      currentDistance++
      sumRoomCoords()

      await Promise.all([
        findRoomInLineAsync(roomCoords.tl, roomCoords.tr, true),
        findRoomInLineAsync(roomCoords.bl, roomCoords.br, true),
        findRoomInLineAsync(roomCoords.tl, roomCoords.bl, false),
        findRoomInLineAsync(roomCoords.tr, roomCoords.br, false),
      ])
    }

    return foundRooms
  }
  const someNearRoomInMinimumSpace = async (room) => {
    const roomCoords = {
      tl: [...room.topLeft],
      tr: [...room.topRight],
      bl: [...room.bottomLeft],
      br: [...room.bottomRight],
    }
    const sumRoomCoords = () => {
      roomCoords.tl[0]--
      roomCoords.tl[1]--
      roomCoords.tr[0]++
      roomCoords.tr[1]--
      roomCoords.bl[0]--
      roomCoords.bl[1]++
      roomCoords.br[0]++
      roomCoords.br[1]++
    }

    let found = false
    const findRoomInLineAsync = async (firstPoint, secondPoint, horizontal) => {
      let start, end, currentCoords, buildCoords
      if (horizontal) {
        start = firstPoint[0]
        end = secondPoint[0] + 1
        buildCoords = (i) => ([i, firstPoint[1]])
      } else {
        start = firstPoint[1]
        end = secondPoint[1] + 1
        buildCoords = (i) => ([firstPoint[0], i])
      }

      let i = start
      while (!found && i < end) {
        i++
        currentCoords = buildCoords(i)
        if (coordsAreInARoom(currentCoords)) {
          const room = Object.values(rooms).find((r) => r.isInside(currentCoords))
          if (room) {
            found = true
            return
          }
        }
      }
    }
    let currentDistance = 0

    while (!found && currentDistance <= minSpaceBetweenRooms) {
      currentDistance++
      sumRoomCoords()

      await Promise.all([
        findRoomInLineAsync(roomCoords.tl, roomCoords.tr, true),
        findRoomInLineAsync(roomCoords.bl, roomCoords.br, true),
        findRoomInLineAsync(roomCoords.tl, roomCoords.bl, false),
        findRoomInLineAsync(roomCoords.tr, roomCoords.br, false),
      ])
    }

    return found
  }
  const generateRooms = async (maxRooms) => {
    let tries = 0
    let keys = Object.keys(emptyCells)

    while ((!maxRooms || rooms.length < maxRooms) && tries < maxTries) {
      tries++
      const topLeftCoords = getCoordsFromKey(
        keys[intRandomBetweenRange(0, keys.length - 1)]
      )

      const testedHeights = {}
      const testedWidths = {}
      let sizeTries = 0
      let room

      while (sizeTries < maxTries) {
        sizeTries++
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
        const bottomRightCoords = [
          topLeftCoords[0] + currentRoomWidth,
          topLeftCoords[1] + currentRoomHeight
        ]
        if (!coordsAreInsideMap(bottomRightCoords)
          || coordsAreInARoom(bottomRightCoords))
          continue

        room = new Room(topLeftCoords, bottomRightCoords)
        if (someRoomOverlap(room)
          || (minSpaceBetweenRooms > 0
            && await someNearRoomInMinimumSpace(room))) {
          room = undefined
          continue
        }
      }

      if (room) {
        addRoom(room)
        keys = Object.keys(emptyCells)
      }
    }
  }

  const changeDirectionClockWise = (direction) => [-direction[1], direction[0]]
  const getEmptyNearestCoords = (coords) => {
    let direction = [1, 0]
    const nearest = undefined
    let tries = 0

    while (!nearest && tries < maxTries) {
      tries++

    }
  }
  const generateCorridors = () => {
    let stop = false
    let currentCoords = [0, 0]
    let direction = [1, 0]

    while (!stop) {
      if (coordsAreInARoom(currentCoords)) {

      }
      stop = true
    }
  }
  // ******************

  for (let i = 0; i < containerWidth; i++) {
    for (let j = 0; j < containerHeight; j++) {
      emptyCells[buildCellKey([i, j])] = true
    }
  }

  await generateRooms(
    config && config.maxRooms ? config.maxRooms : undefined
  )

  const result = {
    rooms: simpleGetProxy(rooms),
    emptyCells: simpleGetProxy(emptyCells),
    roomCells: simpleGetProxy(roomCells)
  }

  if (finishCallback) finishCallback()
  return result
}

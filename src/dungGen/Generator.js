import { Room } from "./Room.js";
import { intRandomBetweenRange } from "../helpers/random.js";
import { simpleGetProxy } from "../helpers/proxy.js";

const ROOM_MAX_SIZE = [20, 20]
const ROOM_MIN_SIZE = [10, 10]
const MIN_SPACE_BETWEEN_ROOMS = 0
const MIN_SPACE_BETWEEN_CORRIDORS = 1
const CORRIDORS_WIDTH = 1

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
  const corridors = [];
  const maxTries = config.maxTries || containerWidth * containerHeight * 0.25
  console.log('MAXTRIES: ', maxTries);
  const minSpaceBetweenRooms = !config
    ? MIN_SPACE_BETWEEN_ROOMS
    : config.minSpaceBetweenRooms
      ? config.minSpaceBetweenRooms
      : MIN_SPACE_BETWEEN_ROOMS
  const minSpaceBetweenCorridors = !config
    ? MIN_SPACE_BETWEEN_CORRIDORS
    : config.minSpaceBetweenCorridors
      ? config.minSpaceBetweenCorridors
      : MIN_SPACE_BETWEEN_CORRIDORS
  const corridorsWidth = !config
    ? CORRIDORS_WIDTH
    : config.corridorsWidth
      ? config.corridorsWidth
      : CORRIDORS_WIDTH

  // ****************** private methods
  const coordsAreInsideMap = (coords) =>
    coords[0] > 0 && coords[0] < containerWidth
    && coords[1] > 0 && coords[1] < containerHeight
  const coordsAreInsideMapIncluding0 = (coords) =>
    coords[0] >= 0 && coords[0] < containerWidth
    && coords[1] >= 0 && coords[1] < containerHeight
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
        if (!coordsAreInsideMap(currentCoords))
          continue
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
        if (!coordsAreInsideMap(currentCoords))
          continue
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

    console.log('>>>>>>>>>> DONE GENERATING ROOMS')
  }

  const changeDirectionClockWise = (direction) => [-direction[1], direction[0]]

  const canBeACorridor = (coords, lastNode) => {
    console.log('>>>>>>>> canBeACorridor');
    const minSpace = minSpaceBetweenCorridors + corridorsWidth
    const getCheckCoords = (i) => {
      const c = []
      let nextC = [coords[0] - 1, coords[1]] //W
      const addCoords = () => {
        if (!lastNode || (nextC[0] != lastNode[0] && nextC[1] != lastNode[1]))
          c.push(nextC)
      }
      addCoords(nextC)
      nextC = [coords[0] + 1, coords[1]] //E
      addCoords(nextC)
      nextC = [coords[0], coords[1] - 1] //N
      addCoords(nextC)
      nextC = [coords[0], coords[1] + 1] //S
      addCoords(nextC)
      nextC = [coords[0] - 1, coords[1] - 1] //NW
      addCoords(nextC)
      nextC = [coords[0] + 1, coords[1] - 1] //NE
      addCoords(nextC)
      nextC = [coords[0] - 1, coords[1] + 1] //SW
      addCoords(nextC)
      nextC = [coords[0] + 1, coords[1] + 1] //SE
      addCoords(nextC)
      return c
    }
    // ? (i) => ([[coords[0], coords[1] - i], [coords[0], coords[1] + i]])
    // : (i) => ([[coords[0] - i, coords[1]], [coords[0] + i, coords[1]]])

    for (let i = 0; i < minSpace; i++) {
      const checkCoords = getCheckCoords(i)
      console.log('CHECK COORDS ', i, checkCoords);
      checkCoords.some((c) => {
        console.log(c)
        console.log(!emptyCells[buildCellKey(c)])
        console.log((i != 0 ? !coordsAreInsideMapIncluding0(c)
          : !coordsAreInsideMap(c)))
      })
      if (checkCoords.some((c) => !emptyCells[buildCellKey(c)]
        || !coordsAreInsideMapIncluding0(c)))
        return false
    }

    return true
  }
  const generateCorridor = (start) => {
    const nearNodes = [start]
    let currentNode, lastNode
    const corridor = {}
    let direction = [1, 0]
    let tries = 0

    const addNodeToCorridor = (coords) => {
      const key = buildCellKey(coords)
      corridor[key] = coords
      delete emptyCells[key]
      if (lastNode) {
        direction = []
        const compare = (first, second) => (
          first == second
            ? 0
            : first > second
              ? 1
              : -1
        )
        direction[0] = compare(currentNode[0], lastNode[0])
        direction[1] = compare(currentNode[1], lastNode[1])
      }
    }
    const addToNearNodes = (node) => {
      if (emptyCells[buildCellKey(node)])
        nearNodes.push(node)
    }

    while (nearNodes.length > 0 && tries < maxTries) {
      tries++
      lastNode = currentNode
      currentNode = nearNodes.shift()
      console.log('CURRNT NODE ', currentNode);
      if (canBeACorridor(currentNode, lastNode)) {
        console.log('canBeACorridor')
        addNodeToCorridor(currentNode)
        //if (direction) {
        addToNearNodes([
          currentNode[0] + direction[0],
          currentNode[1] + direction[1]
        ])
        // } else {
        //   addToNearNodes([currentNode[0] - 1, currentNode[1]]) //W
        //   addToNearNodes([currentNode[0] + 1, currentNode[1]]) //E 
        //   addToNearNodes([currentNode[0], currentNode[1] - 1]) //N
        //   addToNearNodes([currentNode[0], currentNode[1] + 1]) //S}
        // }
        console.log('NEAR NODES ', nearNodes);
      } else {
        direction = changeDirectionClockWise(direction)
        addToNearNodes([
          currentNode[0] + direction[0],
          currentNode[1] + direction[1]
        ])
        currentNode = lastNode
      }
      console.log('------------------------- DONE ', corridor);
    }

    return corridor
    // const findCorridorStartingPosition = () => {

    // }
  }
  const generateAllCorridors = () => {
    let start = [1, 1]
    let tries = 0
    let currentCorridor = generateCorridor(start)
    console.log('####### current corr ', currentCorridor);
    if (Object.keys(currentCorridor).length > 0) {
      corridors.push(currentCorridor)
      console.log(corridors)
    }


    /* while (tries < maxTries) {
      tries++
      currentCorridor = generateCorridor(start)
      //console.log(currentCorridor)
      if (currentCorridor.length > 0) {
        corridors.push(currentCorridor)
        tries = 0
      }
    } */
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
  generateAllCorridors()

  const result = {
    rooms: simpleGetProxy(rooms),
    emptyCells: simpleGetProxy(emptyCells),
    roomCells: simpleGetProxy(roomCells),
    corridors: simpleGetProxy(corridors)
  }

  if (finishCallback) finishCallback()
  return result
}

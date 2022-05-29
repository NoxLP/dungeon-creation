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

  const rooms = {};
  const emptyCells = {};
  const roomCells = {};
  const corridors = [];

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
  const coordsAreInRoomMargin = (coords) => Object.values(rooms).some((r) => r.isInMargin(coords))
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

  const changeDirectionClockWise = (direction) => ([
    direction[1] == 0 ? 0 : -direction[1],
    direction[0]
  ])
  const getPerpendicularDirections = (direction) => (
    [
      [
        direction[1] == 0 ? 0 : -direction[1],
        direction[0]
      ],
      [
        direction[1],
        direction[0] == 0 ? 0 : -direction[0]
      ]
    ]
  )
  const getOppositeDirection = (direction) => ([
    direction[0] == 0 ? 0 : -direction[0],
    direction[1] == 0 ? 0 : -direction[1]
  ])

  const canBeACorridor = (coords, corridor, lastNode, direction) => {
    // nextC = [coords[0] - 1, coords[1] - 1] //NW
    // addCoords(nextC)
    // nextC = [coords[0] + 1, coords[1] - 1] //NE
    // addCoords(nextC)
    // nextC = [coords[0] - 1, coords[1] + 1] //SW
    // addCoords(nextC)
    // nextC = [coords[0] + 1, coords[1] + 1] //SE
    console.groupCollapsed('>>>>>>>> canBeACorridor ', coords);
    const coordsAreOk = (c) =>
      emptyCells[buildCellKey(c)]
      && coordsAreInsideMapIncluding0(c)
    if (!coordsAreOk(coords) || coordsAreInRoomMargin(coords)) {
      console.log('In room margin: ', coordsAreInRoomMargin(coords))
      console.log('Is empty: ', !!emptyCells[buildCellKey(coords)])
      console.log('Is in map: ', coordsAreInsideMapIncluding0(coords))
      console.groupEnd()
      return false
    }

    const minSpace = minSpaceBetweenCorridors + corridorsWidth
    const coordsAreInCorridor = (c) =>
      corridor[buildCellKey(c)]
    const isLastNode = (c) =>
      lastNode && (c[0] == lastNode[0] && c[1] == lastNode[1])

    //const oppositeDirection = getOppositeDirection(direction)
    const perpendicularDirections = getPerpendicularDirections(direction)

    for (let i = 1; i < minSpace; i++) {
      let checkCoords = [
        coords[0] + (direction[0] * i),
        coords[1] + (direction[1] * i)
      ]
      console.log('c same dir ', checkCoords);
      console.log('In corridor: ', coordsAreInCorridor(checkCoords))
      console.log('In room margin: ', coordsAreInRoomMargin(checkCoords))
      console.log('Is empty: ', !!emptyCells[buildCellKey(checkCoords)])
      console.log('Is in map: ', coordsAreInsideMapIncluding0(checkCoords))
      if (!coordsAreOk(checkCoords) || coordsAreInCorridor(checkCoords)) {
        console.groupEnd()
        return false
      }

      for (let d = 0; d < 2; d++) {
        checkCoords = [
          coords[0] + (perpendicularDirections[d][0] * i),
          coords[1] + (perpendicularDirections[d][1] * i)
        ]
        console.log('c perpendic ', checkCoords);
        console.log('In corridor: ', coordsAreInCorridor(checkCoords))
        console.log('In room margin: ', coordsAreInRoomMargin(checkCoords))
        console.log('Is empty: ', !!emptyCells[buildCellKey(checkCoords)])
        console.log('Is in map: ', coordsAreInsideMapIncluding0(checkCoords))
        if (!coordsAreOk(checkCoords) || coordsAreInCorridor(checkCoords)) {
          console.groupEnd()
          return false
        }
      }
    }
    console.groupEnd()

    return true
  }
  const generateCorridor = (start) => {
    let nearNodes = [{
      node: start,
      last: undefined,
      direction: [1, 0]
    }]
    const checkedNodes = []
    let currentNode, lastNode, checkDirection
    const corridor = {}
    let direction = [1, 0]
    let tries = 0

    const addNodeToCorridor = (node) => {
      const key = buildCellKey(node)
      corridor[key] = node
      delete emptyCells[key]
      checkedNodes.push(node)
    }
    const unshiftToNearNodes = (node, currentNode, direction) => {
      if (emptyCells[buildCellKey(node)]
        && !checkedNodes.some((n) =>
          n[0] == node[0] && n[1] == node[1])
        && !nearNodes.some((n) =>
          n[0] == node[0] && n[1] == node[1])) {
        nearNodes.unshift({
          node,
          last: currentNode,
          direction
        })
        return true
      }
      return false
    }
    const pushToNearNodes = (node, currentNode, direction) => {
      if (emptyCells[buildCellKey(node)]
        && !checkedNodes.some((n) =>
          n[0] == node[0] && n[1] == node[1])
        && !nearNodes.some((n) =>
          n[0] == node[0] && n[1] == node[1])) {
        nearNodes.push({
          node,
          last: currentNode,
          direction
        })
        return true
      }
      return false
    }
    const compare = (first, second) => (
      first == second
        ? 0
        : second > first
          ? 1
          : -1
    )

    while (nearNodes.length > 0) {
      console.log('')
      console.log('============== NEW ITERATION ==============')
      tries++
      const near = nearNodes.shift()
      lastNode = near.last
      currentNode = near.node
      direction = near.direction
      checkedNodes.push(currentNode)

      // if (lastNode) {
      //   direction = []
      //   direction[0] = compare(lastNode[0], currentNode[0])
      //   direction[1] = compare(lastNode[1], currentNode[1])
      //   checkDirection = false
      // }

      console.log('CURRENT NODE ', currentNode);
      console.log('last NODE ', lastNode);
      if (canBeACorridor(currentNode, corridor, lastNode, direction)) {
        console.log('YES canBeACorridor ', currentNode)
        console.log('direction: ', direction)
        addNodeToCorridor(currentNode)
        //nearNodes = []
        // getPerpendicularDirections(direction).forEach((perpendicular) => {
        //   const newNearNode = [
        //     currentNode[0] + perpendicular[0],
        //     currentNode[1] + perpendicular[1]
        //   ]
        //   console.log('new near node ', newNearNode)
        //   const push = unshiftToNearNodes(newNearNode, currentNode, direction)
        //   console.log('pushed: ', push)
        // })
        unshiftToNearNodes([
          currentNode[0] + direction[0],
          currentNode[1] + direction[1]
        ],
          currentNode,
          direction
        )
        console.log('next node: ', [
          currentNode[0] + direction[0],
          currentNode[1] + direction[1]
        ])

        // console.log('NEAR NODES ', JSON.stringify(nearNodes));
        // console.groupEnd()
      } else {
        // console.groupEnd()
        console.log('NO canBeACorridor')
        checkedNodes.push(currentNode)
        checkDirection = true
        if (lastNode) currentNode = lastNode

        for (let i = 0; i < 4; i++) {
          direction = changeDirectionClockWise(direction)
          const newNearNode = [
            currentNode[0] + direction[0],
            currentNode[1] + direction[1]
          ]
          console.log('new near node ', newNearNode)
          const push = pushToNearNodes(newNearNode, currentNode, direction)
          console.log('pushed: ', push)
        }
        console.log('NEAR NODES ', JSON.stringify(nearNodes));
      }
      console.log('------------------------- DONE ', corridor);
    }

    return corridor
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
    //find secondary ways
    // Object.values(currentCorridor).forEach((node) => {
    //   // first check corners
    // })


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

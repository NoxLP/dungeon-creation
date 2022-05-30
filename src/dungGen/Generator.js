import { Room } from "./Room.js";
import { Corridor } from "./Corridor.js";
import { intRandomBetweenRange } from "../helpers/random.js";
import { simpleGetProxy } from "../helpers/proxy.js";
import {
  buildCellKey,
  changeDirectionClockWise,
  getPerpendicularDirections,
  getNewCoordsInDirection
} from "../helpers/helpers.js";

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

  const rooms = {}
  const corridors = []
  const emptyCells = {}
  const roomCells = {}
  const corridorCells = {}

  const zonesChecked = []

  // ****************** private methods
  const coordsAreInsideMap = (coords) =>
    coords[0] > 0 && coords[0] < containerWidth
    && coords[1] > 0 && coords[1] < containerHeight
  const coordsAreInsideMapIncluding0 = (coords) =>
    coords[0] >= 0 && coords[0] < containerWidth
    && coords[1] >= 0 && coords[1] < containerHeight
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
  const addCorridor = (corridorData) => {
    const corridor = new Corridor(corridorData)
    corridors.push(corridor)
    corridor.doForAllCoordsInside((c) =>
      corridorCells[buildCellKey(c)] = c
    )
  }
  const someRoomOverlap = (room) => Object.values(rooms).some((r) => room.roomOverlap(r))
  const coordsAreInARoom = (coords) => roomCells[buildCellKey(coords)]
  const coordsAreInRoomMargin = (coords) => Object.values(rooms).some((r) => r.isInMargin(coords))
  const coordsAreInACorridor = (coords) => corridorCells[buildCellKey(coords)]
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

  const canBeACorridor = (coords, corridor, lastNode, direction) => {
    // nextC = [coords[0] - 1, coords[1] - 1] //NW
    // addCoords(nextC)
    // nextC = [coords[0] + 1, coords[1] - 1] //NE
    // addCoords(nextC)
    // nextC = [coords[0] - 1, coords[1] + 1] //SW
    // addCoords(nextC)
    // nextC = [coords[0] + 1, coords[1] + 1] //SE
    // console.groupCollapsed('>>>>>>>> canBeACorridor ', coords);
    const coordsAreOk = (c) =>
      emptyCells[buildCellKey(c)]
      && coordsAreInsideMapIncluding0(c)
    if (!coordsAreOk(coords) || coordsAreInRoomMargin(coords)) {
      // console.log('In room margin: ', coordsAreInRoomMargin(coords))
      // console.log('Is empty: ', !!emptyCells[buildCellKey(coords)])
      // console.log('Is in map: ', coordsAreInsideMapIncluding0(coords))
      // console.groupEnd()
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
      // console.log('c same dir ', checkCoords);
      // console.log('In corridor: ', coordsAreInCorridor(checkCoords))
      // console.log('In room margin: ', coordsAreInRoomMargin(checkCoords))
      // console.log('Is empty: ', !!emptyCells[buildCellKey(checkCoords)])
      // console.log('Is in map: ', coordsAreInsideMapIncluding0(checkCoords))
      if (!coordsAreOk(checkCoords) || coordsAreInCorridor(checkCoords)) {
        // console.groupEnd()
        return false
      }

      for (let d = 0; d < 2; d++) {
        checkCoords = [
          coords[0] + (perpendicularDirections[d][0] * i),
          coords[1] + (perpendicularDirections[d][1] * i)
        ]
        // console.log('c perpendic ', checkCoords);
        // console.log('In corridor: ', coordsAreInCorridor(checkCoords))
        // console.log('In room margin: ', coordsAreInRoomMargin(checkCoords))
        // console.log('Is empty: ', !!emptyCells[buildCellKey(checkCoords)])
        // console.log('Is in map: ', coordsAreInsideMapIncluding0(checkCoords))
        if (!coordsAreOk(checkCoords) || coordsAreInCorridor(checkCoords)) {
          // console.groupEnd()
          return false
        }
      }
    }
    // console.groupEnd()

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

    while (nearNodes.length > 0) {
      // console.log('')
      // console.log('============== NEW ITERATION ==============')
      const near = nearNodes.shift()
      lastNode = near.last
      currentNode = near.node
      direction = near.direction
      checkedNodes.push(currentNode)

      // console.log('CURRENT NODE ', currentNode);
      // console.log('last NODE ', lastNode);
      if (canBeACorridor(currentNode, corridor, lastNode, direction)) {
        // console.log('YES canBeACorridor ', currentNode)
        // console.log('direction: ', direction)
        addNodeToCorridor(currentNode)
        // getPerpendicularDirections(direction).forEach((perpendicular) => {
        //   const newNearNode = [
        //     currentNode[0] + perpendicular[0],
        //     currentNode[1] + perpendicular[1]
        //   ]
        //   console.log('new near node ', newNearNode)
        //   const push = unshiftToNearNodes(newNearNode, currentNode, direction)
        //   console.log('pushed: ', push)
        // })
        unshiftToNearNodes(
          getNewCoordsInDirection(currentNode, direction),
          currentNode,
          direction
        )
        // console.log('next node: ', [
        //   currentNode[0] + direction[0],
        //   currentNode[1] + direction[1]
        // ])

        // console.log('NEAR NODES ', JSON.stringify(nearNodes));
        // console.groupEnd()
      } else {
        // console.groupEnd()
        // console.log('NO canBeACorridor')
        checkedNodes.push(currentNode)
        checkDirection = true
        if (lastNode) currentNode = lastNode

        for (let i = 0; i < 4; i++) {
          direction = changeDirectionClockWise(direction)
          const newNearNode = getNewCoordsInDirection(currentNode, direction)
          // console.log('new near node ', newNearNode)
          const push = pushToNearNodes(newNearNode, currentNode, direction)
          // console.log('pushed: ', push)
        }
        // console.log('NEAR NODES ', JSON.stringify(nearNodes));
      }
      // console.log('------------------------- DONE ', corridor);
    }

    return {
      cells: corridor,
      start
    }
  }
  const zoneIsAlreadyChecked = (zone) => {
    return zonesChecked.some((z) => (
      z.start[0] == zone.start[0] && z.start[1] == zone.start[1] &&
      z.end[0] == zone.end[0] && z.end[1] == zone.end[1]
    ))
  }
  const roomRayIntersectsRoom = async (room, directionName) => {
    // console.log('=========== roomRayIntersectsRoom ', directionName, room)
    // goes south from bottom left, right and center, 
    // searching other room
    const startingPoints = []
    let direction = []

    switch (directionName) {
      case 'east':
        // console.log('> EAST')
        if (room.height >= 5) {
          startingPoints.push(room.topRight)
          startingPoints.push(room.bottomRight)
        }
        if (room.height < 5 || room.height >= 8)
          startingPoints.push([room.topRight[0], room.center[1]])
        direction = [1, 0]
        break;
      case 'west':
        // console.log('> WEST')
        if (room.height >= 5) {
          startingPoints.push(room.topLeft)
          startingPoints.push(room.bottomLeft)
        }
        if (room.height < 5 || room.height >= 8)
          startingPoints.push([room.topLeft[0], room.center[1]])
        direction = [-1, 0]
        break;
      case 'north':
        // console.log('> NORTH')
        if (room.width >= 5) {
          startingPoints.push(room.topLeft)
          startingPoints.push(room.topRight)
        }
        if (room.width < 5 || room.width >= 8)
          startingPoints.push([room.center[0], room.topRight[1]])
        direction = [0, -1]
        break;
      case 'south':
        // console.log('> SOUTH ', room.width)
        if (room.width >= 5) {
          startingPoints.push(room.bottomLeft)
          startingPoints.push(room.bottomRight)
        }
        if (room.width < 5 || room.width >= 8)
          startingPoints.push([room.center[0], room.bottomRight[1]])
        direction = [0, 1]
        break;
    }
    // console.log('> --------------------- HERE')
    // console.log('> starting points: ', startingPoints)
    // console.log('> direction: ', direction)

    const rays = startingPoints.map((startingPoint) => {
      return new Promise((resolve) => {
        let stop = false
        let distance = 0
        let maxDistance = 0
        let maxDistanceIndex = 0
        let currentIndex = 0
        let currentPoint = [...startingPoint]
        const intersectionPoints = []
        let tries = 0
        while (!stop && tries < maxTries / 4) {
          tries++
          currentPoint = getNewCoordsInDirection(currentPoint, direction)
          // console.log('> current point: ', currentPoint)

          if (!coordsAreInsideMap(currentPoint)
            || !emptyCells[buildCellKey(currentPoint)]) { // intersects!
            if (!coordsAreInsideMap(currentPoint)) {
              currentPoint = [
                currentPoint[0] - direction[0],
                currentPoint[1] - direction[1],
              ]
              stop = true
            }
            // console.log('> intersects!')
            intersectionPoints.push({
              point: currentPoint,
              distance: distance
            })
            if (distance > maxDistance) {
              maxDistance = distance
              maxDistanceIndex = currentIndex
            }
            currentIndex++
            // is a room
            if (coordsAreInARoom(currentPoint)) stop = true
            // is a corridor
            else distance = 0
          }

          distance++
        }

        if (intersectionPoints.length > 0) {
          resolve({
            start: intersectionPoints.length == 1 || maxDistanceIndex == 0
              ? startingPoint
              : intersectionPoints[maxDistanceIndex - 1].point,
            end: intersectionPoints[maxDistanceIndex].point,
            distance: intersectionPoints[maxDistanceIndex].distance
          })
        }
        else
          resolve(null)
      })
    })

    try {
      let intersections = await Promise.all(rays)

      if (intersections.some((i) => i)) {
        intersections = intersections
          .filter((i) => i
            && !zoneIsAlreadyChecked(i)
            && i.distance >= ((2 * minSpaceBetweenCorridors) + corridorsWidth)
          )
          .sort((a, b) => b.distance - a.distance)
        // console.log('>> intersections: ', intersections)
        if (intersections && intersections.length > 0) {
          // console.log('>> return intersections')
          return intersections[0]
        }
      }

      // console.log('>> reject')
      return Promise.reject(null)
    } catch (err) {
      // console.log('************************* ERROR ')
      // console.log(err.message);                   // "All Promises rejected"
      // console.log(err.name);                      // "AggregateError"
      // console.log(err.errors);                    // [ Error: "some error" ]
      return Promise.reject(null)
    }
  }
  const findFirstEmptyZoneBetweenRooms = async () => {
    const myRooms = Object.values(rooms)
    const directions = ['west', 'east', 'north', 'south']
    const intersectionsPromises = []
    for (let i = 0; i < myRooms.length; i++) {
      for (let d = 0; d < 4; d++) {
        intersectionsPromises.push(roomRayIntersectsRoom(myRooms[i], directions[d]))
      }
    }

    try {
      let intersections = await Promise.any(intersectionsPromises)
      // console.log('************************* intersections', intersections)

      return intersections
    } catch (err) {
      // console.log('************************* null ')
      // console.log(err.message);                   // "All Promises rejected"
      // console.log(err.name);                      // "AggregateError"
      // console.log(err.errors);                    // [ Error: "some error" ]
      return null
    }
  }
  const generateAllCorridors = async () => {
    let corridorStart = [1, 1]
    let intersection = await findFirstEmptyZoneBetweenRooms()

    while (intersection) {
      // console.log('####### current inter ', intersection);
      zonesChecked.push(intersection)
      // console.log('####### current checked ', zonesChecked);
      const xMin = Math.min(intersection.start[0], intersection.end[0])
      const yMin = Math.min(intersection.start[1], intersection.end[1])
      corridorStart = [
        Math.floor(
          Math.abs(intersection.start[0] - intersection.end[0]) * 0.5 + xMin),
        Math.floor(
          Math.abs(intersection.start[1] - intersection.end[1]) * 0.5 + yMin),
      ]
      // console.log('####### current start ', corridorStart);
      let currentCorridor = generateCorridor(corridorStart)
      // console.log('####### current corr ', currentCorridor);
      if (currentCorridor && Object.keys(currentCorridor.cells).length > 2) {
        addCorridor(currentCorridor)
        // console.log(corridors)
      } else if (Object.keys(currentCorridor.cells).length <= 2) {
        Object.keys(currentCorridor.cells).forEach((k) => emptyCells[k] = true)
      }

      intersection = await findFirstEmptyZoneBetweenRooms()
    }
  }
  const findRandomPassagesToOtherCorridor = (corridor) => {
    // find passages between corridors or corridors and rooms

    // find all possible passages
    const possiblePassages = {}
    const addCellIfPossible = (cell, newCell, direction) => {
      if (coordsAreInACorridor(newCell) && !corridor.coordsAreInside(newCell)) {
        const otherCorridor = corridors.find((c) => c.coordsAreInside(newCell))
        if (!possiblePassages[otherCorridor.id])
          possiblePassages[otherCorridor.id] = { otherCorridor, cells: [] }
        possiblePassages[otherCorridor.id].cells.push({
          newCell,
          own: cell,
          direction
        })
      }
    }
    corridor.walkCorridor((cell, direction) => {
      let newCell
      if (direction) {
        newCell = getNewCoordsInDirection(cell, direction, 2)
        addCellIfPossible(cell, newCell, direction)

        const perpendiculars = getPerpendicularDirections(direction)
        for (let p = 0; p < 2; p++) {
          newCell = getNewCoordsInDirection(cell, perpendiculars[p], 2)
          addCellIfPossible(cell, newCell, perpendiculars[p])
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const checkDirection = changeDirectionClockWise(direction)
          newCell = getNewCoordsInDirection(cell, checkDirection, 2)
          addCellIfPossible(cell, newCell, checkDirection)
        }
      }
    })

    if (possiblePassages.length == 0) return null
    //return possiblePassages

    // create one passage per "other" corridor
    Object.keys(possiblePassages).forEach((key) => {
      const otherCorridor = possiblePassages[key].otherCorridor
      const newCellObject = possiblePassages[key].cells[
        intRandomBetweenRange(0, possiblePassages[key].cells.length - 1)
      ]
      const newCell = getNewCoordsInDirection(
        newCellObject.own,
        newCellObject.direction,
        1
      )
      const newCellKey = buildCellKey(newCell)
      corridorCells[newCellKey] = newCell
      delete emptyCells[newCellKey]
      corridor.addCell(newCell)
      corridor.passages[otherCorridor.id] = {
        other: otherCorridor.id,
        cell: newCell
      }
      otherCorridor.addCell(newCell)
      otherCorridor.passages[corridor.id] = {
        other: corridor.id,
        cell: newCell
      }
    })
  }
  // ****************** end fields, properties, methods

  for (let i = 0; i < containerWidth; i++) {
    for (let j = 0; j < containerHeight; j++) {
      emptyCells[buildCellKey([i, j])] = true
    }
  }

  await generateRooms(
    config && config.maxRooms ? config.maxRooms : undefined
  )
  await generateAllCorridors()
  console.log('CORS: ', corridors)
  corridors.forEach((c) => findRandomPassagesToOtherCorridor(c))


  const result = {
    rooms: simpleGetProxy(rooms),
    emptyCells: simpleGetProxy(emptyCells),
    roomCells: simpleGetProxy(roomCells),
    corridors: simpleGetProxy(corridors),
  }

  if (finishCallback) finishCallback()
  return result
}

import { Room } from "./Room.js";
import { Corridor } from "./Corridor.js";
import { intRandomBetweenRange } from "../helpers/random.js";
import { simpleGetProxy } from "../helpers/proxy.js";
import {
  buildCellKey,
  getNewDirectionClockWise,
  getNewDirectionAntiClockWise,
  getPerpendicularDirections,
  getNewCoordsInDirection,
  coordsEqual,
  getOppositeDirection
} from "../helpers/helpers.js";

const ROOM_MAX_SIZE = [20, 20]
const ROOM_MIN_SIZE = [10, 10]
const MIN_SPACE_BETWEEN_ROOMS = 0
const MIN_SPACE_BETWEEN_CORRIDORS = 1
const CORRIDORS_WIDTH = 1
const MORE_THAN_ONE_PASSAGE_IN_ROOM_PROBABILITY = 0.5

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
  const roomPassagesCountProb = !config
    ? MORE_THAN_ONE_PASSAGE_IN_ROOM_PROBABILITY
    : 'roomPassagesCountProb' in config
      && config.roomPassagesCountProb < 1
      && config.roomPassagesCountProb >= 0
      ? config.roomPassagesCountProb
      : MORE_THAN_ONE_PASSAGE_IN_ROOM_PROBABILITY

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
    console.log(corridorData)
    const corridor = new Corridor(corridorData)
    corridors.push(corridor)
    corridor.doForAllCoordsInside((c) =>
      corridorCells[buildCellKey(c)] = c
    )
    return corridor
  }
  const builCorridorFromPassage = (passage) => {
    const startKey = buildCellKey(passage.start)
    const endKey = buildCellKey(passage.end)
    delete emptyCells[startKey]
    delete emptyCells[endKey]
    return addCorridor({
      cells: {
        [startKey]: passage.start,
        [endKey]: passage.end,
      },
      start: passage.start
    })
  }
  const someRoomOverlap = (room) => Object.values(rooms).some((r) => room.roomOverlap(r))
  const coordsAreInARoom = (coords) => roomCells[buildCellKey(coords)]
  const coordsAreInRoomMargin = (coords) => Object.values(rooms).some((r) => r.isInMargin(coords))
  const coordsAreInACorridor = (coords) => corridorCells[buildCellKey(coords)]
  const findCorridorsByCell = (coords) => corridors.filter((corr) => corr.isInside(coords))
  const findRoomsByCell = (coords) => Object.values(rooms).filter((room) => room.isInside(coords))
  const getStraightNeighbours = (coords) => {
    let direction = [1, 0]
    const neighbours = []
    let currentNeighbour

    for (let i = 0; i < 4; i++) {
      currentNeighbour = getNewCoordsInDirection(coords, direction)
      if (coordsAreInsideMapIncluding0(currentNeighbour))
        neighbours.push(currentNeighbour)
      direction = getNewDirectionClockWise(direction)
    }

    return neighbours
  }

  const addPassageBetweenCorridors = (corridor, otherCorridor, cell) => {
    const cellKey = buildCellKey(cell)
    corridorCells[cellKey] = cell
    delete emptyCells[cellKey]
    corridor.addCell(cell)
    corridor.passages[otherCorridor.id] = {
      other: otherCorridor.id,
      cell: cell
    }
    otherCorridor.addCell(cell)
    otherCorridor.passages[corridor.id] = {
      other: corridor.id,
      cell: cell
    }
  }
  const addPassageBetweenRoomAndCorridor = (corridor, room, cell) => {
    const cellKey = buildCellKey(cell)
    corridorCells[cellKey] = cell
    delete emptyCells[cellKey]
    corridor.addCell(cell)
    corridor.passages[room.id] = {
      other: room.id,
      cell: cell
    }
    room.passages[corridor.id] = {
      other: corridor.id,
      cell: cell
    }
  }

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
  const generateRoomsAsync = async (maxRooms) => {
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
        checkDirection = true
        if (lastNode) currentNode = lastNode

        for (let i = 0; i < 4; i++) {
          direction = getNewDirectionClockWise(direction)
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
  const generateAllCorridorsAsync = async () => {
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
      if (coordsAreInACorridor(newCell) && !corridor.isInside(newCell)) {
        const otherCorridor = corridors.find((c) => c.isInside(newCell))
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
          const checkDirection = getNewDirectionClockWise(direction)
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
      addPassageBetweenCorridors(corridor, otherCorridor, newCell)
    })
  }
  const findPassagesFromRooms = () => {
    Object.values(rooms).forEach((r) => {
      // console.groupCollapsed('ROOM ', r)
      // iterate room margin
      const currentPossiblePassages = {}
      //const passagesTo = {}
      let direction = [1, 0]
      // first cell is the one above the room top left, then iterate clock wise
      let firstCell = getNewCoordsInDirection(r.topLeft, [0, -1], 1)
      let currentLoopCell = firstCell
      let currentCheckCell
      let currentCheckDirection
      do {
        // console.log('cur cell ', JSON.stringify(currentLoopCell))
        currentCheckDirection = getNewDirectionAntiClockWise(direction)

        if (!r.isMarginCorner(currentLoopCell)) {
          for (let i = 0; i < 2; i++) {
            currentCheckCell = getNewCoordsInDirection(currentLoopCell, currentCheckDirection, i)
            const currentCheckKey = buildCellKey(currentCheckCell)
            if (!emptyCells[currentCheckKey]) {
              const currentLoopKey = buildCellKey(currentLoopCell)
              let obj = roomCells[currentCheckKey]
              const passage = i == 0
                ? currentLoopCell
                : {
                  start: currentLoopCell,
                  end: getNewCoordsInDirection(currentLoopCell, currentCheckDirection, 1)
                }
              if (obj) {
                const rooms = findRoomsByCell(currentCheckCell)
                rooms.forEach((room) => {
                  if (!currentPossiblePassages[room.id])
                    currentPossiblePassages[room.id] = []
                  currentPossiblePassages[room.id].push(passage)
                })
                break
              } else {
                obj = corridorCells[currentCheckKey]
                if (obj) {
                  const corridors = findCorridorsByCell(currentCheckCell)
                  corridors.forEach((corridor) => {
                    if (!currentPossiblePassages[corridor.id])
                      currentPossiblePassages[corridor.id] = []
                    currentPossiblePassages[corridor.id].push(passage)
                  })
                  break
                }
              }
            }
          }
        }

        currentLoopCell = getNewCoordsInDirection(currentLoopCell, direction)
        // console.log('> pre ', JSON.stringify(currentLoopCell))
        if (!r.isInMargin(currentLoopCell)) {
          // console.log('> NOT in margin');
          // console.log(r.xMax)
          // console.log(r.xMin)
          // console.log(r.yMax)
          // console.log(r.yMin)
          currentLoopCell = getNewCoordsInDirection(
            currentLoopCell,
            getOppositeDirection(direction)
          )
          direction = getNewDirectionClockWise(direction)
          // console.log('NEW direction ', JSON.stringify(direction));
          currentLoopCell = getNewCoordsInDirection(
            currentLoopCell,
            direction
          )
        }
      }
      while (!coordsEqual(firstCell, currentLoopCell));

      // console.log(currentPossiblePassages)
      // console.groupEnd()

      const currentPossiblePassagesIds = Object.keys(currentPossiblePassages)
      currentPossiblePassagesIds.forEach((passageId) => {
        const passages = currentPossiblePassages[passageId]
        const passage = passages[intRandomBetweenRange(0, passages.length - 1)]
        const roomPassagesCount = Object.keys(r.passages).length
        if (roomPassagesCount == 0 || Math.random() > roomPassagesCountProb) {
          if (passageId.substring(0, 4) == 'corr') {
            const corridor = corridors.find((c) => c.id == passageId)
            // console.log(corridor)
            // passage to a corridor
            if (!Array.isArray(passage)) {
              // console.log('ARRAY ', passage)
              const newCorridor = builCorridorFromPassage(passage)
              addPassageBetweenCorridors(
                newCorridor,
                corridor,
                passage.end
              )
              addPassageBetweenRoomAndCorridor(
                newCorridor,
                r,
                passage.start
              )
            } else {
              addPassageBetweenRoomAndCorridor(
                corridor,
                r,
                passage
              )
            }
          } else if (!Array.isArray(passage)) {
            // room => impossible to have room passages of length 1
            // can't draw rooms that near next to another
            const newCorridor = builCorridorFromPassage(passage)
            addPassageBetweenRoomAndCorridor(
              newCorridor,
              r,
              passage.start
            )
            addPassageBetweenRoomAndCorridor(
              newCorridor,
              rooms[passage.id],
              passage.end
            )
          }
        }
      })
    })
  }

  const walkAndRemoveCorridorDeadEnds = (corridor) => {
    console.groupCollapsed('corr: ', corridor.id)
    console.log('start: ', corridor.start)
    console.log('passages: ', corridor.passages)
    const cellsToRemove = new Set()

    // locate deadEnds
    corridor.deadEnds = {}
    corridor.doForAllCoordsInside((cell) => {
      if (!corridor.hasMoreThanNumberNeighboursInside(cell, 1))
        corridor.deadEnds[buildCellKey(cell)] = cell
    })
    console.log('dends ', corridor.deadEnds)

    //walk corridor from dead ends    
    Object.values(corridor.deadEnds).forEach((deadEnd) => {
      console.log('---------- NUEVO DEAD END')
      if (!corridor.isInside(deadEnd))
        console.error('NO ESTA')
      else if (!corridor.isAPassage(deadEnd)) {
        console.log(deadEnd)
        cellsToRemove.add(deadEnd)

        let neighbours
        let currentCell = deadEnd
        let direction = [1, 0]
        let checkedCells = new Set()

        while (!neighbours
          || (neighbours.numberOfNeighbours < 3
            && neighbours.numberOfNeighbours > 0)
        ) {
          // has only one neighbour inside corridor => go to first neighbour
          if (neighbours) {
            const sameDirectionCell = getNewCoordsInDirection(currentCell, direction, 1)
            if (corridor.isInside(sameDirectionCell)
              && !checkedCells.has(buildCellKey(sameDirectionCell))
            ) {
              console.log('sameDirectionCell')
              currentCell = sameDirectionCell
            } else {
              console.log('other direction')
              const firstCell = neighbours.cells[neighbours.firstIndex]
              if (!checkedCells.has(buildCellKey(firstCell))) {
                console.log('first direction')
                currentCell = firstCell
                direction = neighbours.firstDirection
              } else {
                direction = getNewDirectionAntiClockWise(neighbours.firstDirection)
                currentCell = undefined
                for (let i = 0; i < neighbours.cells.length; i++) {
                  console.log('direction')
                  direction = getNewDirectionClockWise(direction)
                  const checkingCell = neighbours.cells[i]
                  if (checkingCell && !checkedCells.has(buildCellKey(checkingCell))) {
                    console.log('found!!!')
                    currentCell = checkingCell
                    break
                  }
                  console.log('nope :(')
                }

                if (!currentCell) break
              }
            }
            console.log(currentCell)
          }
          checkedCells.add(buildCellKey(currentCell))

          neighbours = corridor.findFirstNeighbourAndNeighbours(
            currentCell,
            direction
          )
          console.log(`neighbours of ${JSON.stringify(currentCell)}`, neighbours)

          if (neighbours.numberOfNeighbours < 3
            && neighbours.numberOfNeighbours > 0) {
            // previous cell and next cell, or another deadend
            console.log('neighbours < 3')
            cellsToRemove.add(currentCell)
            console.log(cellsToRemove)
          } else break
        }
      }
    })

    console.log('TO REMOVE: ', cellsToRemove)

    console.groupEnd()
    return cellsToRemove
  }
  const removeCorridorsDeadEnds = () => {
    for (let i = 0; i < 2; i++) {
      corridors.forEach((c) => {
        const myCellsToRemove = Array.from(walkAndRemoveCorridorDeadEnds(c))
        myCellsToRemove.forEach((mc) => {
          c.removeCell(mc)
          delete emptyCells[buildCellKey(mc)]
        })
      })
    }
  }
  // ****************** end fields, properties, methods

  for (let i = 0; i < containerWidth; i++) {
    for (let j = 0; j < containerHeight; j++) {
      emptyCells[buildCellKey([i, j])] = true
    }
  }

  await generateRoomsAsync(
    config && config.maxRooms ? config.maxRooms : undefined
  )
  await generateAllCorridorsAsync()
  console.log('CORS: ', corridors)
  corridors.forEach((c) => findRandomPassagesToOtherCorridor(c))

  findPassagesFromRooms()
  removeCorridorsDeadEnds()

  const result = {
    rooms: simpleGetProxy(rooms),
    emptyCells: simpleGetProxy(emptyCells),
    roomCells: simpleGetProxy(roomCells),
    corridors: simpleGetProxy(corridors),
  }

  if (finishCallback) finishCallback()
  return result
}

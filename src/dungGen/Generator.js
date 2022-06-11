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

// ****************** config variables
const ROOM_MAX_SIZE = [20, 20]
const ROOM_MIN_SIZE = [10, 10]
const MIN_SPACE_BETWEEN_ROOMS = 0
const MIN_SPACE_BETWEEN_CORRIDORS = 1
const CORRIDORS_WIDTH = 1
const MORE_THAN_ONE_PASSAGE_IN_ROOM_PROBABILITY = 0.5

let containerWidth, containerHeight, roomMaxSize, roomMinSize, maxTries,
  minSpaceBetweenRooms, minSpaceBetweenCorridors, corridorsWidth,
  roomPassagesCountProb

// ****************** private fields
const rooms = {}
const corridors = []
const emptyCells = {}
const roomCells = {}
const corridorCells = {}
const zonesChecked = []

// ****************** private methods

// ******* helpers
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


// ******* generate rooms
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


// ******* generate corridors
const canBeACorridor = (coords, corridor, lastNode, direction) => {
  const coordsAreOk = (c) =>
    emptyCells[buildCellKey(c)]
    && coordsAreInsideMapIncluding0(c)
  if (!coordsAreOk(coords) || coordsAreInRoomMargin(coords))
    return false

  const minSpace = minSpaceBetweenCorridors + corridorsWidth
  const coordsAreInCorridor = (c) =>
    corridor[buildCellKey(c)]
  const perpendicularDirections = getPerpendicularDirections(direction)

  for (let i = 1; i < minSpace; i++) {
    let checkCoords = [
      coords[0] + (direction[0] * i),
      coords[1] + (direction[1] * i)
    ]
    if (!coordsAreOk(checkCoords) || coordsAreInCorridor(checkCoords))
      return false

    for (let d = 0; d < 2; d++) {
      checkCoords = [
        coords[0] + (perpendicularDirections[d][0] * i),
        coords[1] + (perpendicularDirections[d][1] * i)
      ]
      if (!coordsAreOk(checkCoords) || coordsAreInCorridor(checkCoords))
        return false
    }
  }

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
    const near = nearNodes.shift()
    lastNode = near.last
    currentNode = near.node
    direction = near.direction
    checkedNodes.push(currentNode)

    if (canBeACorridor(currentNode, corridor, lastNode, direction)) {
      addNodeToCorridor(currentNode)
      unshiftToNearNodes(
        getNewCoordsInDirection(currentNode, direction),
        currentNode,
        direction
      )
    } else {
      checkDirection = true
      if (lastNode) currentNode = lastNode

      for (let i = 0; i < 4; i++) {
        direction = getNewDirectionClockWise(direction)
        const newNearNode = getNewCoordsInDirection(currentNode, direction)
        const push = pushToNearNodes(newNearNode, currentNode, direction)
      }
    }
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
  // goes south from bottom left, right and center, 
  // searching other room
  const startingPoints = []
  let direction = []

  switch (directionName) {
    case 'east':
      if (room.height >= 5) {
        startingPoints.push(room.topRight)
        startingPoints.push(room.bottomRight)
      }
      if (room.height < 5 || room.height >= 8)
        startingPoints.push([room.topRight[0], room.center[1]])
      direction = [1, 0]
      break;
    case 'west':
      if (room.height >= 5) {
        startingPoints.push(room.topLeft)
        startingPoints.push(room.bottomLeft)
      }
      if (room.height < 5 || room.height >= 8)
        startingPoints.push([room.topLeft[0], room.center[1]])
      direction = [-1, 0]
      break;
    case 'north':
      if (room.width >= 5) {
        startingPoints.push(room.topLeft)
        startingPoints.push(room.topRight)
      }
      if (room.width < 5 || room.width >= 8)
        startingPoints.push([room.center[0], room.topRight[1]])
      direction = [0, -1]
      break;
    case 'south':
      if (room.width >= 5) {
        startingPoints.push(room.bottomLeft)
        startingPoints.push(room.bottomRight)
      }
      if (room.width < 5 || room.width >= 8)
        startingPoints.push([room.center[0], room.bottomRight[1]])
      direction = [0, 1]
      break;
  }

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

        if (!coordsAreInsideMap(currentPoint)
          || !emptyCells[buildCellKey(currentPoint)]) {
          // intersects!
          if (!coordsAreInsideMap(currentPoint)) {
            currentPoint = [
              currentPoint[0] - direction[0],
              currentPoint[1] - direction[1],
            ]
            stop = true
          }

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
      if (intersections && intersections.length > 0)
        return intersections[0]
    }

    return Promise.reject(null)
  } catch (err) {
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

    return intersections
  } catch (err) {
    return null
  }
}

const generateAllCorridorsAsync = async () => {
  let corridorStart = [1, 1]
  let intersection = await findFirstEmptyZoneBetweenRooms()

  while (intersection) {
    zonesChecked.push(intersection)
    const xMin = Math.min(intersection.start[0], intersection.end[0])
    const yMin = Math.min(intersection.start[1], intersection.end[1])
    corridorStart = [
      Math.floor(
        Math.abs(intersection.start[0] - intersection.end[0]) * 0.5 + xMin),
      Math.floor(
        Math.abs(intersection.start[1] - intersection.end[1]) * 0.5 + yMin),
    ]

    let currentCorridor = generateCorridor(corridorStart)
    if (currentCorridor && Object.keys(currentCorridor.cells).length > 2) {
      addCorridor(currentCorridor)
    } else if (Object.keys(currentCorridor.cells).length <= 2) {
      Object.keys(currentCorridor.cells).forEach((k) => emptyCells[k] = true)
    }

    intersection = await findFirstEmptyZoneBetweenRooms()
  }
  console.log('>>>>>>>>>> DONE GENERATING CORRIDORS')
}


// ******* generate passages
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
  console.log('>>>>>>>>>> DONE FINDING PASSAGES BETWEEN CORRIDORS')
}

const findPassagesFromRooms = () => {
  Object.values(rooms).forEach((r) => {
    // iterate room margin

    const currentPossiblePassages = {}
    let direction = [1, 0]

    // first cell is the one above the room top left, then iterate clock wise
    let firstCell = getNewCoordsInDirection(r.topLeft, [0, -1], 1)
    let currentLoopCell = firstCell
    let currentCheckCell
    let currentCheckDirection
    do {
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
      if (!r.isInMargin(currentLoopCell)) {
        currentLoopCell = getNewCoordsInDirection(
          currentLoopCell,
          getOppositeDirection(direction)
        )
        direction = getNewDirectionClockWise(direction)
        currentLoopCell = getNewCoordsInDirection(
          currentLoopCell,
          direction
        )
      }
    } while (!coordsEqual(firstCell, currentLoopCell));

    const currentPossiblePassagesIds = Object.keys(currentPossiblePassages)
    currentPossiblePassagesIds.forEach((passageId) => {
      const passages = currentPossiblePassages[passageId]
      const passage = passages[intRandomBetweenRange(0, passages.length - 1)]
      const roomPassagesCount = Object.keys(r.passages).length
      if (roomPassagesCount == 0 || Math.random() > roomPassagesCountProb) {
        if (passageId.substring(0, 4) == 'corr') {
          // passage to a corridor

          const corridor = corridors.find((c) => c.id == passageId)
          if (!Array.isArray(passage)) {
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
  console.log('>>>>>>>>>> DONE FINDING PASSAGES FROM ROOMS')
}


// ******* remove dead ends
const walkCorridorFromDeadEndsAndGetCellsToRemove = (corridor) => {
  const cellsToRemove = new Set()

  // locate deadEnds
  corridor.deadEnds = {}
  corridor.doForAllCoordsInside((cell) => {
    if (!corridor.hasMoreThanNumberNeighboursInside(cell, 1))
      corridor.deadEnds[buildCellKey(cell)] = cell
  })

  //walk corridor from dead ends    
  Object.values(corridor.deadEnds).forEach((deadEnd) => {
    if (!corridor.isAPassage(deadEnd)) {
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
            currentCell = sameDirectionCell
          } else {
            const firstCell = neighbours.cells[neighbours.firstIndex]
            if (!checkedCells.has(buildCellKey(firstCell))) {
              currentCell = firstCell
              direction = neighbours.firstDirection
            } else {
              direction = getNewDirectionAntiClockWise(neighbours.firstDirection)
              currentCell = undefined
              for (let i = 0; i < neighbours.cells.length; i++) {
                direction = getNewDirectionClockWise(direction)
                const checkingCell = neighbours.cells[i]
                if (checkingCell && !checkedCells.has(buildCellKey(checkingCell))) {
                  currentCell = checkingCell
                  break
                }
              }

              if (!currentCell) break
            }
          }
        }
        checkedCells.add(buildCellKey(currentCell))

        neighbours = corridor.findFirstNeighbourAndNeighbours(
          currentCell,
          direction
        )

        if (neighbours.numberOfNeighbours < 3
          && neighbours.numberOfNeighbours > 0) {
          // previous cell and next cell, or another deadend
          cellsToRemove.add(currentCell)
        } else break
      }
    }
  })

  return cellsToRemove
}

const removeCorridorsDeadEnds = () => {
  corridors.forEach((c) => {
    let cellsToRemove

    while (!cellsToRemove || cellsToRemove.length > 0) {
      // the function above return cells to remove when one walk the corridor
      // starting at every dead ends. By removing this cells, more dead ends
      // can be created at corridor's T interections, therefor the while
      cellsToRemove = Array.from(walkCorridorFromDeadEndsAndGetCellsToRemove(c))
      cellsToRemove.forEach((mc) => {
        c.removeCell(mc)
        delete emptyCells[buildCellKey(mc)]
      })
    }
  })
  console.log('>>>>>>>>>> DONE REMOVING DEAD ENDS')
}


// yeah, I could use classes... I wouldn't have private members and
// I don't need typescript
export async function Generator(width, height, config, finishCallback) {
  containerWidth = width;
  containerHeight = height;

  roomMaxSize = !config
    ? ROOM_MAX_SIZE
    : config.roomMaxSize
      ? config.roomMaxSize
      : ROOM_MAX_SIZE;
  roomMinSize = !config
    ? ROOM_MIN_SIZE
    : config.roomMinSize
      ? config.roomMinSize
      : ROOM_MIN_SIZE;
  maxTries = config.maxTries || containerWidth * containerHeight * 0.25
  minSpaceBetweenRooms = !config
    ? MIN_SPACE_BETWEEN_ROOMS
    : config.minSpaceBetweenRooms
      ? config.minSpaceBetweenRooms
      : MIN_SPACE_BETWEEN_ROOMS
  minSpaceBetweenCorridors = !config
    ? MIN_SPACE_BETWEEN_CORRIDORS
    : config.minSpaceBetweenCorridors
      ? config.minSpaceBetweenCorridors
      : MIN_SPACE_BETWEEN_CORRIDORS
  corridorsWidth = !config
    ? CORRIDORS_WIDTH
    : config.corridorsWidth
      ? config.corridorsWidth
      : CORRIDORS_WIDTH
  roomPassagesCountProb = !config
    ? MORE_THAN_ONE_PASSAGE_IN_ROOM_PROBABILITY
    : 'roomPassagesCountProb' in config
      && config.roomPassagesCountProb < 1
      && config.roomPassagesCountProb >= 0
      ? config.roomPassagesCountProb
      : MORE_THAN_ONE_PASSAGE_IN_ROOM_PROBABILITY

  for (let i = 0; i < containerWidth; i++) {
    for (let j = 0; j < containerHeight; j++) {
      emptyCells[buildCellKey([i, j])] = true
    }
  }

  await generateRoomsAsync(
    config && config.maxRooms ? config.maxRooms : undefined
  )
  await generateAllCorridorsAsync()
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

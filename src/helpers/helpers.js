export const buildCellKey = (coords) => `${coords[0]},${coords[1]}`

export const changeDirectionClockWise = (direction) => ([
  direction[1] == 0 ? 0 : -direction[1],
  direction[0]
])

export const getPerpendicularDirections = (direction) => (
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

export const getOppositeDirection = (direction) => ([
  direction[0] == 0 ? 0 : -direction[0],
  direction[1] == 0 ? 0 : -direction[1]
])

export const getNewCoordsInDirection = (coords, direction, distance) => (
  [
    coords[0] + (distance ? direction[0] * distance : direction[0]),
    coords[1] + (distance ? direction[1] * distance : direction[1]),
  ]
)

// export const getPerpendicularCells = (cell, direction) => {
//   const pDirections = getPerpendicularDirections(direction)
//   return [
//     getNewCoordsInDirection(cell, pDirections[0]),
//     getNewCoordsInDirection(cell, pDirections[1]),
//   ]
// }
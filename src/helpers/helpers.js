export const buildCellKey = (coords) => `${coords[0]},${coords[1]}`

export const getNewDirectionClockWise = (direction) => ([
  direction[1] == 0 ? 0 : -direction[1],
  direction[0]
])

export const getNewDirectionAntiClockWise = (direction) => ([
  direction[1],
  direction[0] == 0 ? 0 : -direction[0],
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

export const coordsEqual = (coords1, coords2) =>
  coords1[0] == coords2[0] && coords1[1] == coords2[1]
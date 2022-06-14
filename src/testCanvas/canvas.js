const RATIO_ADJUST = 1
const canvas = document.getElementById('container')
const ctx = canvas.getContext ? canvas.getContext('2d') : undefined
let ratio = [1, 1]
let lastCorridor = -1

export function setRatio(x, y) {
  ratio = [
    canvas.clientWidth / x,
    canvas.clientHeight / y,
  ]
}

const applyRatio = (num, coord) => {
  if (coord == 'x') return num * ratio[0] * RATIO_ADJUST
  if (coord == 'y') return num * ratio[1] * RATIO_ADJUST
  return undefined
}
export function cleanCanvas() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    lastCorridor = -1
  }
}
export function drawGrid(width, height) {
  if (ctx) {
    for (let i = 0; i < width; i++) {
      if (i % 10 == 0) ctx.fillStyle = ctx.strokeStyle = 'rgb(120,120,120)'
      else ctx.strokeStyle = 'rgb(190,190,190)'
      ctx.beginPath()
      ctx.moveTo(applyRatio(i, 'x'), 0)
      ctx.lineTo(applyRatio(i, 'x'), applyRatio(height, 'y'))
      ctx.stroke()
    }
    for (let i = 0; i < height; i++) {
      if (i % 10 == 0) ctx.fillStyle = ctx.strokeStyle = 'rgb(120,120,120)'
      else ctx.strokeStyle = 'rgb(190,190,190)'
      ctx.beginPath()
      ctx.moveTo(0, applyRatio(i, 'y'))
      ctx.lineTo(applyRatio(width, 'y'), applyRatio(i, 'y'))
      ctx.stroke()
    }
  }
}
export function drawRoom(room) {
  if (ctx) {
    ctx.fillStyle = 'rgb(0,255,0)'
    ctx.fillRect(
      applyRatio(room.topLeft[0], 'x'),
      applyRatio(room.topLeft[1], 'y'),
      applyRatio(Math.abs(room.bottomRight[0] - room.topLeft[0]) + 1, 'x'),
      applyRatio(Math.abs(room.bottomRight[1] - room.topLeft[1]) + 1, 'y')
    )
    ctx.fillStyle = 'rgb(0,0,0)'
    ctx.font = "14px Arial"
    ctx.fillText(
      `TL: ${room.topLeft}
BR: ${room.bottomRight}`,
      applyRatio(room.topLeft[0], 'x'),
      applyRatio(room.center[1], 'y')
    )
  }
}
const CORRIDOR_COLORS = [
  'a52a2a',
  'f4a460',
  'd2691e',
  '8b4513',
  'ed1c24',
  '703642',
  '4169e1',
  '1e90ff',
  '00ced1',
  '708090',
  '9932cc',
  'ff1dce',
  '8b008b',
  'ff4500',
  'ffc40c',
]
export function drawCorridor(corridor, corridorWidth) {
  if (ctx) {
    ctx.fillStyle = CORRIDOR_COLORS.length > 0 ?
      `#${CORRIDOR_COLORS[++lastCorridor]}` :
      Math.floor(Math.random() * 16777215).toString(16)
    ctx.font = "14px Arial"
    ctx.fillText(
      `ID: ${corridor.id} \n
start: ${corridor.start}`,
      applyRatio(corridor.start[0], 'x'),
      applyRatio(corridor.start[1], 'y')
    )
    Object.values(corridor.cells).forEach((c) => {
      ctx.fillRect(
        applyRatio(c[0], 'x'),
        applyRatio(c[1], 'y'),
        //Right now, width is always 1
        applyRatio(1, 'x'),
        applyRatio(1, 'y'),
      )
    })
  }
}
export function drawCell(cell, color) {
  if (ctx) {
    ctx.fillStyle = color
    ctx.fillRect(
      applyRatio(cell[0], 'x'),
      applyRatio(cell[1], 'y'),
      //Right now, width is always 1
      applyRatio(1, 'x'),
      applyRatio(1, 'y'),
    )
  }
}
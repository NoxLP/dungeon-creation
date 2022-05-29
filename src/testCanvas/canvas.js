const RATIO_ADJUST = 1
const canvas = document.getElementById('container')
const ctx = canvas.getContext ? canvas.getContext('2d') : undefined
let ratio = [1, 1]

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
      applyRatio(Math.abs(room.bottomRight[0] - room.topLeft[0]), 'x'),
      applyRatio(Math.abs(room.bottomRight[1] - room.topLeft[1]), 'y')
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
export function drawCorridor(corridor, corridorWidth) {
  if (ctx) {
    ctx.fillStyle = 'rgb(205,127,50)'
    corridor.forEach((c) => {
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
const RATIO_ADJUST = 0.9
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
import { Generator } from "./dungGen/Generator.js";
import { Room } from "./dungGen/Room.js";
import { cleanCanvas, drawRoom, drawCorridor, drawCell, drawGrid, setRatio } from "./testCanvas/canvas.js";

const container = document.getElementById('container')
const generating = document.getElementById('generando')
generating.style.display = 'none'

document.getElementById('clean').addEventListener('click', async () => {
  cleanCanvas()
})
document.getElementById('configSubmit').addEventListener('click', async () => {
  generating.style.display = ''
  const gridX = document.getElementById('gridWidthInput').value
  const gridY = document.getElementById('gridHeightInput').value
  cleanCanvas()
  console.clear()
  console.log('>>>>>>>>>> START')

  const generator = await Generator(gridX, gridY, {
    maxTries: document.getElementById('maxTriesInput').value,
    roomMaxSize: [
      parseInt(document.getElementById('roomXMaxInput').value),
      parseInt(document.getElementById('roomYMaxInput').value),
    ],
    roomMinSize: [
      parseInt(document.getElementById('roomXMinInput').value),
      parseInt(document.getElementById('roomYMinInput').value),
    ],
    roomPassagesCountProb: document.getElementById('roomProbInput').value,
    minSpaceBetweenRooms: document.getElementById('roomSpaceInput').value,
    minSpaceBetweenRooms: document.getElementById('corridorSpaceInput').value,
  },
    (generator) => {
      generating.style.display = 'none'
      setRatio(gridX, gridY)
      drawGrid(gridX, gridY)

      console.log(generator)
      console.log(generator.rooms);

      // console.log(generator.isInsideSomeRoom([2, 2]));
      // console.log(generator.isInsideSomeRoom([12, 12]));
      // console.log(generator.isInsideSomeRoom([18, 18]));
      console.log('FIND ROOM----: ')

      //generator.generateRooms()
      console.groupCollapsed('GENERATED ROOMS')
      Object.values(generator.rooms).forEach((r) => {
        console.log(`FROM: ${r.topLeft}`)
        console.log(`TO: ${r.bottomRight}`)
        console.log('-----')
        drawRoom(r)
      })
      console.groupEnd()
      console.log(generator.corridors);
      generator.corridors.forEach((c) => drawCorridor(c))

      let i = 0
      Object.values(generator.corridors).forEach((c) => Object.values(c.passages).forEach((p) => {
        ++i
        setTimeout(() => {
          drawCell(p.cell, '#000000')
        }, i * 15)
      }))
    })
  window.generator = generator
})
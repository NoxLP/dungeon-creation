import { Generator } from "./dungGen/Generator.js";
import { Room } from "./dungGen/Room.js";
import { drawRoom, drawCorridor, drawGrid, setRatio } from "./testCanvas/canvas.js";

const container = document.getElementById('container')

const gridX = 100
const gridY = 50
const generator = await Generator(gridX, gridY, {
  roomMaxSize: [15, 15],
  roomMinSize: [5, 5],
  minSpaceBetweenRooms: 1,
  //maxTries: 1000
  //maxRooms: 30
},
  () => document.getElementById('generando').style.display = 'none')
window.generator = generator
setRatio(gridX, gridY)
drawGrid(gridX, gridY)

console.log(generator)
console.log(generator.rooms);

const testRoom = new Room([0, 0], [10, 10])
console.log(testRoom);
console.log('HERE----: ', testRoom.isInside([2, 2]))

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
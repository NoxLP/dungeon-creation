import { Generator } from "./dungGen/Generator.js";
import { Room } from "./dungGen/Room.js";

const container = document.getElementById('container')

const generator = new Generator(Math.floor(container.clientWidth / 20), Math.floor(container.clientHeight / 20))

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
console.log('GENERATED: ', generator);
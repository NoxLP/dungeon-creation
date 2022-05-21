import { Generator } from "./dungGen/Generator.js";
import { Room } from "./dungGen/Room.js";

const container = document.getElementById('container')

const generator = new Generator(container.clientWidth, container.clientHeight)

console.log(generator)
console.log(generator.rooms);

const testRoom = new Room([0, 0], [10, 10])
console.log(testRoom);

console.log('HERE----: ', testRoom.coordsAreInside([2, 2]))
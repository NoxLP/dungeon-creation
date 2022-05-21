import { Generator } from "./dungGen/Generator.js";

const container = document.getElementById('container')

const generator = new Generator(container.clientWidth, container.clientHeight)

console.log(generator)
console.log(generator.rooms);
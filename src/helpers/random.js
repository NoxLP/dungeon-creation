/**
 * [min, max]
 * float
 * @param {*} min 
 * @param {*} max 
 * @returns 
 */
export function randomBetweenRange(min, max) {
  return (Math.random() * (max - min + 1)) + min
}
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

/**
 * [min, max]
 * int
 * @param {*} min 
 * @param {*} max 
 * @param {*} resultsToAvoidObject Optional
 * @returns 
 */
export function intRandomBetweenRange(min, max, resultsToAvoidObject) {
  if (!resultsToAvoidObject)
    return Math.floor((Math.random() * (max - min + 1)) + min)
  else {
    const range = max - min + 1
    const rest = range - Object.keys(resultsToAvoidObject).length

    if (rest > 1) {
      let result = Math.floor((Math.random() * (max - min + 1)) + min)
      while (`${result}` in resultsToAvoidObject) {
        result = Math.floor((Math.random() * (max - min + 1)) + min)
      }

      resultsToAvoidObject[`${result}`] = 1
      return result
    } else if (rest == 1) {
      for (let i = min; i <= max; i++) {
        if (!(`${i}` in resultsToAvoidObject)) {
          resultsToAvoidObject[i] = 1
          return i
        }
      }
    }

    return undefined
  }
}
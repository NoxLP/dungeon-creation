export function simpleGetProxy(item) {
  return new Proxy(item, {
    get: (target, prop, receiver) => Reflect.get(target, prop, receiver)
  })
}
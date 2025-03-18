export const wait = (ms: number) => {
  return (new Promise<void>((res, rej) => {
    setTimeout(() => {
      res()
    }, ms)
  }))
}
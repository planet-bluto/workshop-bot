export type TimeRange = [number, number?]
export type CompleteTimeRange = [number, number]

export const ALL_TIME = () => ([0, Date.now()])

export function rangeAutocomplete(range: TimeRange): CompleteTimeRange {
  return [range[0], (range[1] ?? Date.now())]
}

export function rangeLength(range: TimeRange) {
  const complete_range = rangeAutocomplete(range)
  
  const result = Math.abs(complete_range[1] - complete_range[0])
  // print("rangeLength Result: ", range, result)
  return result
}

function _calcRangeDelta(rangeA: CompleteTimeRange, rangeB: CompleteTimeRange, inRange: boolean) {
  return (rangeLength(rangeA) == 0 ? (inRange ? 1 : 0) : rangeLength(rangeA) / rangeLength(rangeB))
}

export type TimeRangeInterceptResult = {
  outOfRange: [boolean, boolean];
  inRange: boolean;
  intercepts: boolean;
  range: CompleteTimeRange;
  outerDelta: number;
  innerDelta: number;
}
export function rangeIntercept(innerRange: TimeRange, outerRange: TimeRange): TimeRangeInterceptResult {
  const c_innerRange = rangeAutocomplete(innerRange)
  // print("c_innerRange: ", c_innerRange)
  const c_outerRange = rangeAutocomplete(outerRange)
  // print("outerRange: ", outerRange)

  if (c_outerRange[1] == Infinity) {
    print("dont do that")
  }

  let outOfRange: [boolean, boolean] = [false, false]
  let finalRange: CompleteTimeRange = c_innerRange
  let intercepts = true
  
  if (c_innerRange[0] < c_outerRange[0]) { finalRange[0] = c_outerRange[0]; outOfRange[0] = true }
  if (c_innerRange[1] > c_outerRange[1]) { finalRange[1] = c_outerRange[1]; outOfRange[1] = true }
  if (c_innerRange[1] < c_outerRange[0] || c_innerRange[0] > c_outerRange[1]) { finalRange = [0, 0]; intercepts = false }
  
  const inRange = outOfRange.every(bool => !bool)

  const result: TimeRangeInterceptResult = {
    outOfRange,
    inRange,
    intercepts,
    range: finalRange,
    outerDelta: _calcRangeDelta(finalRange, c_outerRange, intercepts),
    innerDelta: _calcRangeDelta(finalRange, c_innerRange, inRange)
  }

  // print("result: ", result)

  return result
}
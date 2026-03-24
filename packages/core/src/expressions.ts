import { ArrowExpression } from './html'

export const expressionPool: Array<number | ArrowExpression | undefined> = []
const expressionObservers: Array<CallableFunction | undefined> = []
const freeExpressionPointers: number[][] = []
let cursor = 0

export function createExpressionBlock(len: number): number {
  const bucket = freeExpressionPointers[len]
  const pointer = bucket?.length ? bucket.pop()! : cursor
  expressionPool[pointer] = len
  if (pointer === cursor) cursor += len + 1
  return pointer
}

export function writeExpressions(
  expSlots: ArrayLike<unknown>,
  pointer: number,
  offset = 0
): void {
  const len = expressionPool[pointer] as number
  for (let i = 1; i <= len; i++) {
    const nextValue = expSlots[offset + i - 1] as ArrowExpression
    const target = pointer + i
    if (Object.is(expressionPool[target], nextValue)) continue
    expressionPool[target] = nextValue
    expressionObservers[target]?.(nextValue)
  }
}

export function onExpressionUpdate(
  pointer: number,
  observer?: CallableFunction
): void {
  expressionObservers[pointer] = observer
}

export function releaseExpressions(pointer: number): void {
  const len = expressionPool[pointer] as number | undefined
  if (len === undefined) return
  for (let i = 0; i <= len; i++) {
    expressionPool[pointer + i] = undefined
    expressionObservers[pointer + i] = undefined
  }
  ;(freeExpressionPointers[len] ??= []).push(pointer)
}

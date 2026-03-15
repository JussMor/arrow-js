import { ArrowExpression } from './html'

export const expressionPool: Array<number | ArrowExpression> = []
const expressionObservers: CallableFunction[] = []
const freeExpressionPointers: number[][] = []
let cursor = 0

export function storeExpressions(expSlots: ArrowExpression[]): number {
  const len = expSlots.length
  const bucket = freeExpressionPointers[len]
  const pointer = bucket?.length ? bucket.pop()! : cursor
  expressionPool[pointer] = len
  for (let i = 0; i < len; i++) {
    expressionPool[pointer + i + 1] = expSlots[i]
  }
  if (pointer === cursor) cursor += len + 1
  return pointer
}

export function updateExpressions(
  sourcePointer: number,
  toPointer: number
): void {
  if (sourcePointer === toPointer) return
  const len = expressionPool[sourcePointer] as number
  for (let i = 1; i <= len; i++) {
    const pointer = toPointer + i
    expressionPool[pointer] = expressionPool[sourcePointer + i]
    expressionObservers[pointer]?.(expressionPool[pointer])
  }
}

export function onExpressionUpdate(
  pointer: number,
  observer: CallableFunction
): void {
  expressionObservers[pointer] = observer
}

export function releaseExpressions(pointer: number): void {
  const len = expressionPool[pointer] as number | undefined
  if (len === undefined) return
  for (let i = 0; i <= len; i++) {
    delete expressionPool[pointer + i]
    delete expressionObservers[pointer + i]
  }
  ;(freeExpressionPointers[len] ??= []).push(pointer)
}

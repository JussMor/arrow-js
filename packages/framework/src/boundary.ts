import { html } from '@arrow-js/core'
import type { ArrowTemplate } from '@arrow-js/core/internal'
import { getRenderContext } from './context'
import { toTemplate } from './render'

export interface BoundaryOptions {
  idPrefix?: string
}

let clientBoundaryIndex = 0

export function boundary(view: unknown, options: BoundaryOptions = {}): ArrowTemplate {
  const template = toTemplate(view)
  const prefix = options.idPrefix ?? 'b'
  let id = ''
  let registeredIn: object | null = null

  return html`${() => {
    const context = getRenderContext()

    if (!id) {
      id = context
        ? context.claimBoundaryId(prefix)
        : `${prefix}:client:${clientBoundaryIndex++}`
    }

    if (context && registeredIn !== context) {
      context.registerBoundary(id)
      registeredIn = context
    }

    return html`<template data-arrow-boundary-start="${id}"></template>${template}<template data-arrow-boundary-end="${id}"></template>`
  }}` as ArrowTemplate
}

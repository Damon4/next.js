/* eslint-env jest */

import { nextTestSetup } from 'e2e-utils'
import { SourceMapConsumer } from 'next/dist/compiled/source-map'

const nextConfig = {
  productionBrowserSourceMaps: true,
}

function indexToLineColumn(text: string, index: number) {
  let line = 1
  let column = 0

  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') {
      line += 1
      column = 0
    } else {
      column += 1
    }
  }

  return { line, column }
}

function findOriginalLine(
  consumer: SourceMapConsumer,
  generated: string,
  needle: RegExp
) {
  const match = needle.exec(generated)

  expect(match).not.toBeNull()
  const index = match.index

  const { line, column } = indexToLineColumn(generated, index)
  return consumer.originalPositionFor({
    line,
    column,
  })
}

describe('Global CSS Sourcemaps', () => {
  const { next, isNextDev, skipped } = nextTestSetup({
    files: __dirname,
    skipDeployment: true,
    nextConfig,
  })

  if (skipped) return
  ;(isNextDev ? describe.skip : describe)('Production only', () => {
    it('maps global CSS declarations to original CSS lines', async () => {
      const $ = await next.render$('/')
      const cssSheet = $('link[rel="stylesheet"]').first()

      expect(cssSheet.length).toBe(1)

      const stylesheetUrl = cssSheet.attr('href')
      const cssContent = await next
        .fetch(stylesheetUrl)
        .then((res) => res.text())

      const sourceMapMatch = /\/\*#\s*sourceMappingURL=(.+\.map)\s*\*\//.exec(
        cssContent
      )

      expect(sourceMapMatch).not.toBeNull()

      const sourceMapUrl = sourceMapMatch[1]
      const actualSourceMapUrl = stylesheetUrl.replace(/[^/]+$/, sourceMapUrl)
      const sourceMapContent = await next
        .fetch(actualSourceMapUrl)
        .then((res) => res.text())

      const sourceMapContentParsed = JSON.parse(sourceMapContent)
      const consumer = await new SourceMapConsumer(sourceMapContentParsed)

      try {
        const selectorMatch = /(\.[^{]+)\{/.exec(cssContent)

        expect(selectorMatch).not.toBeNull()

        const selectorIndex = selectorMatch.index
        const selectorOriginal = consumer.originalPositionFor(
          indexToLineColumn(cssContent, selectorIndex)
        )

        expect(selectorOriginal.source).toContain('global.css')
        expect(selectorOriginal.line).toBe(5)

        const colorOriginal = findOriginalLine(consumer, cssContent, /color:/)

        expect(colorOriginal.source).toContain('global.css')
        expect(colorOriginal.line).toBe(6)

        const paddingOriginal = findOriginalLine(
          consumer,
          cssContent,
          /padding:/
        )

        expect(paddingOriginal.source).toContain('global.css')
        expect(paddingOriginal.line).toBe(7)

        const backgroundOriginal = findOriginalLine(
          consumer,
          cssContent,
          /background-color:/
        )

        expect(backgroundOriginal.source).toContain('global.css')
        expect(backgroundOriginal.line).toBe(8)
      } finally {
        consumer.destroy?.()
      }
    })
  })
})

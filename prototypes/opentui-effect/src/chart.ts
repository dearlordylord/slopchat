import { FrameBufferRenderable, RGBA, type FrameBufferOptions, type OptimizedBuffer, type RenderContext } from "@opentui/core"
import { extend, type ExtendedComponentProps } from "@opentui/react"

interface ChartOptions extends FrameBufferOptions { samples?: ReadonlyArray<number> }
const background = RGBA.fromHex("#0b1220")
const cyan = RGBA.fromHex("#42d9e8")
const grid = RGBA.fromHex("#32445b")
const violet = RGBA.fromHex("#b59bff")
// A custom core framebuffer renderable, not an upstream chart widget.
export class MetricsChart extends FrameBufferRenderable {
  private values: ReadonlyArray<number>
  constructor(ctx: RenderContext, options: ChartOptions) {
    super(ctx, options)
    this.values = options.samples ?? []
  }
  set samples(samples: ReadonlyArray<number>) { this.values = samples; this.requestRender() }
  protected override renderSelf(buffer: OptimizedBuffer) {
    const fb = this.frameBuffer
    fb.clear(background)
    const width = fb.width; const height = fb.height
    const compact = height < 7
    const left = compact ? 0 : 5
    const top = compact ? 0 : 1
    const plotWidth = Math.max(1, width - (compact ? 0 : 7))
    const plotHeight = Math.max(1, height - (compact ? 0 : 4))
    if (!compact) for (const value of [0, 50, 100]) {
      const y = top + Math.round((100 - value) / 100 * (plotHeight - 1))
      fb.drawText(String(value).padStart(3), 0, y, grid)
      for (let x = 4; x < width; x++) fb.setCell(x, y, "·", grid, background)
    }
    let previousY: number | undefined
    for (let x = 0; x < plotWidth; x++) {
      const index = Math.round(x / Math.max(1, plotWidth - 1) * (this.values.length - 1))
      const value = this.values[index] ?? 0
      const y = top + Math.round((100 - value) / 100 * (plotHeight - 1))
      if (previousY !== undefined) for (let row = Math.min(y, previousY); row <= Math.max(y, previousY); row++) fb.setCell(x + left, row, "│", cyan, background)
      fb.setCell(x + left, y, "●", cyan, background)
      previousY = y
    }
    if (!compact) fb.drawText("samples →", 5, height - 2, violet)
    super.renderSelf(buffer)
  }
}
extend({ metricsChart: MetricsChart })
declare module "@opentui/react" {
  interface OpenTUIComponents { metricsChart: typeof MetricsChart }
}
export type ChartProps = ExtendedComponentProps<typeof MetricsChart>

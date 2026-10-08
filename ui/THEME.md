# Theme attribution

Official V2 TUI documentation: https://dev.opencode.ai/v2/docs/themes/

Palette: https://github.com/anomalyco/opencode/blob/5b312918ecd673fdcc76094471a87067f0fa36e7/packages/tui/src/theme/assets/v2/opencode.json
Revision: `5b312918ecd673fdcc76094471a87067f0fa36e7` (v2 branch). MIT-licensed OpenCode, anomalyco and contributors. This is the TUI V2 palette, not desktop/web JSON. The documented schema path has moved at this revision to `packages/theme/src/tui/schema.ts`.

Focused default: OpenCode dark. Neutral 800/700/600 map to background/panel/composer; neutral 200/400 to text/muted; border.base to borders. Interactive orange 200 maps to user and chart; accent purple 200 to agent; cyan 200 to tool/info; red/green 200 to error/success. Role assignments are SlopChat semantic mappings, not upstream role prescriptions. No theme selector or light mode is introduced.

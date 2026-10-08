import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { RegistryProvider } from "@effect/atom-react"
import { App } from "./app"
const renderer = await createCliRenderer({ exitOnCtrlC: true })
createRoot(renderer).render(<RegistryProvider><App /></RegistryProvider>)

import { createFileRoute } from '@tanstack/react-router'
import { LathaAdmin } from '@latha/start'

// One catch-all route mounts the entire admin; LathaAdmin routes internally.
export const Route = createFileRoute('/admin/$')({
  component: LathaAdmin,
})

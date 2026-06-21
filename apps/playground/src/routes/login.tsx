import { createFileRoute } from '@tanstack/react-router'
import { LathaLogin } from '@latha/start'

export const Route = createFileRoute('/login')({
  component: LathaLogin,
})

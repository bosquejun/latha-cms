/**
 * Example widget — an entity-scoped panel in the create/edit form sidebar.
 *
 * Entity-scoped zones (`form.*`, `list.*`, `global.*`) hand the widget the
 * current `entity` (and `recordId` on edit). Declare `entities` in the config
 * to scope the widget — the registry filters it out for other entities, and
 * views rely on that for layout (a form with no applicable sidebar widgets
 * doesn't reserve the sidebar column at all).
 */

import { defineWidgetConfig, type WidgetContext } from '@kon10/start'
import { Card, CardHeader, CardTitle, CardContent } from '@kon10/ui'

export const config = defineWidgetConfig({
  zone: 'form.sidebar.before',
  entities: ['posts'],
})

export default function PostTips({ recordId }: WidgetContext) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Writing tips</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-small text-muted-foreground">
        {recordId
          ? 'Editing an existing post — remember to bump the status to “published” when it’s ready.'
          : 'New post: a clear title becomes the slug automatically.'}
      </CardContent>
    </Card>
  )
}

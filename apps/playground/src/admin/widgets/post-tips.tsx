/**
 * Example widget — an entity-scoped panel in the create/edit form sidebar.
 *
 * Entity-scoped zones (`form.*`, `list.*`, `document.*`) hand the widget the
 * current `entity` (and `recordId` on edit), so a widget can tailor itself or
 * bail out for entities it doesn't care about.
 */

import { defineWidgetConfig, type WidgetContext } from '@latha/start'
import { Card, CardHeader, CardTitle, CardContent } from '@latha/ui'

export const config = defineWidgetConfig({ zone: 'form.sidebar.before' })

interface EntityLike {
  slug?: string
}

export default function PostTips({ entity, recordId }: WidgetContext) {
  // Only show on the `posts` collection.
  if ((entity as EntityLike)?.slug !== 'posts') return null
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

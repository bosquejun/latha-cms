/**
 * Default sidebar icons for the three built-in entity kinds.
 *
 * These are the admin-sdk's owned defaults — start (or any other integration
 * layer) should import them here rather than hardcoding its own mapping.
 * Modules that want a different icon for their entities can pass an explicit
 * `icon` through the extensions nav system.
 */

import { FileTextIcon, FileStackIcon, FolderTreeIcon } from 'lucide-animated'
import type { SidebarIcon } from './Sidebar.js'
import type { EntityKind } from '../schema.js'

export const KIND_ICON: Record<EntityKind, SidebarIcon> = {
  collection: FileTextIcon,
  document: FileStackIcon,
  taxonomy: FolderTreeIcon,
}

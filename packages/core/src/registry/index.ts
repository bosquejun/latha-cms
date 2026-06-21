/**
 * Module registry + resolution order.
 *
 * Modules declare `dependsOn: ['auth', 'users']`; the kernel topologically
 * sorts them so that a module always initializes after everything it depends
 * on. Cycles are detected and reported.
 */

import type { CMSModule } from '../types/config.js'
import type { Entity } from '../types/collection.js'

export class ModuleRegistry {
  private readonly modules = new Map<string, CMSModule>()

  /** Register a module. Throws on duplicate names. */
  register(module: CMSModule): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Duplicate module registered: "${module.name}".`)
    }
    this.modules.set(module.name, module)
  }

  registerAll(modules: CMSModule[]): void {
    for (const m of modules) this.register(m)
  }

  get(name: string): CMSModule | undefined {
    return this.modules.get(name)
  }

  has(name: string): boolean {
    return this.modules.has(name)
  }

  /**
   * Return modules in dependency-resolved order (a module appears after all
   * of its `dependsOn` entries). Uses a depth-first topological sort.
   */
  resolve(): CMSModule[] {
    const resolved: CMSModule[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const visit = (module: CMSModule, trail: string[]): void => {
      if (visited.has(module.name)) return
      if (visiting.has(module.name)) {
        throw new Error(
          `Circular module dependency detected: ${[...trail, module.name].join(' → ')}`,
        )
      }
      visiting.add(module.name)

      for (const depName of module.dependsOn ?? []) {
        const dep = this.modules.get(depName)
        if (!dep) {
          throw new Error(
            `Module "${module.name}" depends on "${depName}", which is not registered.`,
          )
        }
        visit(dep, [...trail, module.name])
      }

      visiting.delete(module.name)
      visited.add(module.name)
      resolved.push(module)
    }

    for (const module of this.modules.values()) {
      visit(module, [])
    }

    return resolved
  }

  /** Flatten every entity contributed by every registered module. */
  collectEntities(): Entity[] {
    const entities: Entity[] = []
    const seen = new Set<string>()
    for (const module of this.modules.values()) {
      for (const entity of module.entities ?? []) {
        if (seen.has(entity.slug)) {
          throw new Error(
            `Duplicate entity slug "${entity.slug}" (contributed by "${module.name}").`,
          )
        }
        seen.add(entity.slug)
        entities.push(entity)
      }
    }
    return entities
  }
}

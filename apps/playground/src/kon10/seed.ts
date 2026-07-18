import { operations, type Kon10Instance } from '@kon10/core'
import { getCatalog, getRoleByName, hashPassword } from '@kon10/auth'
import { countUsers, createUser } from '@kon10/users'

export async function seed(kon10: Kon10Instance): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (email && password && (await countUsers(kon10)) === 0) {
    const adminRole = await getRoleByName(kon10, 'admin')
    await createUser(kon10, {
      email,
      name: 'Admin',
      roles: adminRole ? [adminRole.id] : [],
      passwordHash: await hashPassword(password),
    })
    console.log(`[kon10] seeded admin: ${email} / ${password}`)
  }

  if (!(await getRoleByName(kon10, 'author'))) {
    const catalog = getCatalog(kon10)
    const permissionIds = ['studio:access', 'posts:create', 'posts:read']
      .map((key) => catalog?.permissionIdByKey.get(key))
      .filter((id): id is string => typeof id === 'string')

    await kon10.db.create('roles', {
      name: 'author',
      label: 'Author',
      description: 'Can write and manage their own posts.',
      permissions: permissionIds,
      system: false,
    })
    console.log('[kon10] seeded role: author')
  }

  const systemContext = {
    cms: kon10,
    principal: { id: '__system__', permissions: ['*'] },
  }

  if ((await kon10.db.count('categories')) === 0) {
    const engineering = await operations.create(systemContext, 'categories', {
      name: 'Engineering',
      slug: 'engineering',
    })
    await operations.create(systemContext, 'categories', {
      name: 'Frameworks',
      slug: 'frameworks',
      parent: engineering.id,
    })
    await operations.create(systemContext, 'categories', {
      name: 'Design',
      slug: 'design',
    })
    console.log('[kon10] seeded categories')
  }

  if ((await kon10.db.count('tags')) === 0) {
    for (const name of ['nextjs', 'cms', 'release']) {
      await operations.create(systemContext, 'tags', { name, slug: name })
    }
    console.log('[kon10] seeded tags')
  }
}

/**
 * @latha/users — the users collection and role system.
 */

export { UsersModule, USERS_SLUG, type UsersModuleConfig } from './module.js'
export {
  createUser,
  countUsers,
  listUsers,
  type CreateUserInput,
} from './operations.js'

/**
 * Every `User` column except `password`. Use it wherever a user is included in
 * data that can reach the browser (`include: { user: { select: safeUserSelect } }`)
 * so password hashes never leave the server.
 */
export const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  isBlacklisted: true,
  commentStatus: true,
  commentRestrictedUntil: true,
} as const;

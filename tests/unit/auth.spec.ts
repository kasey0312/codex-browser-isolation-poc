import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/server/db/database.js';
import { createUser, getUserCount, verifyUser } from '../../src/server/auth/userStore.js';
import { signAccessToken, verifyAccessToken } from '../../src/server/auth/jwt.js';

beforeEach(() => {
  db.exec('DELETE FROM users');
});

describe('auth flow', () => {
  it('creates a user, verifies the password, and signs a JWT', async () => {
    const user = await createUser('Alice', 'supersecure');
    expect(user.username).toBe('alice');

    const verified = await verifyUser('alice', 'supersecure');
    expect(verified?.id).toBe(user.id);

    const token = await signAccessToken(user);
    const decoded = await verifyAccessToken(token);
    expect(decoded?.username).toBe('alice');
  });

  it('enforces the 4-user poc limit', async () => {
    for (let index = 0; index < 4; index += 1) {
      await createUser(`user${index}`, 'supersecure');
    }

    await expect(createUser('user4', 'supersecure')).rejects.toThrow(/limit/i);
  });

  it('normalizes usernames and rejects duplicates after trimming', async () => {
    await createUser('  MixedCase  ', 'supersecure');
    await expect(createUser('mixedcase', 'supersecure')).rejects.toThrow(/already exists/i);
    const verified = await verifyUser('  MIXEDCASE ', 'supersecure');
    expect(verified?.username).toBe('mixedcase');
  });

  it('allows the user pool to be recreated after the database is reset', async () => {
    for (let index = 0; index < 4; index += 1) {
      await createUser(`user${index}`, 'supersecure');
    }

    expect(getUserCount()).toBe(4);
    db.exec('DELETE FROM users');
    const resetUser = await createUser('after-reset', 'supersecure');
    expect(resetUser.username).toBe('after-reset');
    expect(getUserCount()).toBe(1);
  });
}

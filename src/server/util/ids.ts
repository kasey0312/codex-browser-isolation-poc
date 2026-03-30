import { customAlphabet } from 'nanoid';

const id = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export function createId(prefix: string) {
  return `${prefix}_${id()}`;
}

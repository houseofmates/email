import { expect, test } from 'vitest'
import { generatePassword } from '../services/crypto'

test('generatePassword length', () => {
  const pw = generatePassword(20);
  expect(pw.length).toBe(20);
});

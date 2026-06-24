import { expect, test } from 'vitest'
import { generatePassword } from '../services/crypto'

test('generatePassword length', () => {
  const pw = generatePassword(20);
  expect(pw.length).toBe(20);
});

test('generatePassword default length', () => {
  const pw = generatePassword();
  expect(pw.length).toBe(16);
});

test('generatePassword contains uppercase when enabled', () => {
  const pw = generatePassword(50, { uppercase: true, numbers: false, symbols: false });
  expect(/[A-Z]/.test(pw)).toBe(true);
});

test('generatePassword contains numbers when enabled', () => {
  const pw = generatePassword(50, { uppercase: false, numbers: true, symbols: false });
  expect(/[0-9]/.test(pw)).toBe(true);
});

test('generatePassword contains symbols when enabled', () => {
  const pw = generatePassword(50, { uppercase: false, numbers: false, symbols: true });
  expect(/[!@#$%^&*()_+~|}{[\]:;?><,.\/-=]/.test(pw)).toBe(true);
});

test('generatePassword only lowercase when all options disabled', () => {
  const pw = generatePassword(20, { uppercase: false, numbers: false, symbols: false });
  expect(/^[a-z]+$/.test(pw)).toBe(true);
});

test('generatePassword handles edge case length 0', () => {
  const pw = generatePassword(0);
  expect(pw.length).toBe(0);
  expect(pw).toBe('');
});

test('generatePassword handles large length', () => {
  const pw = generatePassword(1000);
  expect(pw.length).toBe(1000);
});

test('generatePassword generates unique passwords', () => {
  const pw1 = generatePassword(20);
  const pw2 = generatePassword(20);
  const pw3 = generatePassword(20);
  expect(pw1).not.toBe(pw2);
  expect(pw2).not.toBe(pw3);
  expect(pw1).not.toBe(pw3);
});

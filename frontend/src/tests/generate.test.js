import { describe, it, expect } from 'vitest'
function generatePassword(len = 24) {
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_"
  let o = ""
  for (let i = 0; i < len; i++) o += c.charAt(Math.floor(Math.random() * c.length))
  return o
}
describe('Password Generator', () => {
  it('should generate a password of the correct length', () => {
    const pwd = generatePassword(16)
    expect(pwd).toHaveLength(16)
  })
})

import { describe, it, expect } from 'vitest'

describe('Simple Test Suite', () => {
  it('performs basic math operations', () => {
    expect(2 + 2).toBe(4)
    expect(10 - 5).toBe(5)
    expect(3 * 4).toBe(12)
    expect(20 / 4).toBe(5)
  })

  it('handles string operations', () => {
    const greeting = 'Hello'
    const name = 'World'
    expect(`${greeting} ${name}`).toBe('Hello World')
    expect(greeting.toLowerCase()).toBe('hello')
    expect(name.toUpperCase()).toBe('WORLD')
  })

  it('works with arrays', () => {
    const numbers = [1, 2, 3, 4, 5]
    expect(numbers).toHaveLength(5)
    expect(numbers).toContain(3)
    expect(numbers[0]).toBe(1)
    expect(numbers[numbers.length - 1]).toBe(5)
  })

  it('works with objects', () => {
    const user = { name: 'John', age: 30 }
    expect(user).toHaveProperty('name')
    expect(user.name).toBe('John')
    expect(user.age).toBe(30)
  })
})
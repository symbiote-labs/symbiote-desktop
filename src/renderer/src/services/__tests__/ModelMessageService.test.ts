import { ChatCompletionMessageParam } from 'openai/resources'
import { describe, expect, it } from 'vitest'

import { processReqMessages } from '../ModelMessageService'

describe('ModelMessageService', () => {
  const mockMessages: ChatCompletionMessageParam[] = [
    { role: 'user', content: 'First question' },
    { role: 'user', content: 'Additional context' },
    { role: 'assistant', content: 'First answer' },
    { role: 'assistant', content: 'Additional information' },
    { role: 'user', content: 'Second question' },
    { role: 'assistant', content: 'Second answer' }
  ]

  it('should interleave messages with same role for deepseek-reasoner model', () => {
    const model = { id: 'deepseek-reasoner', provider: 'test', name: 'Test Model', group: 'Test' }
    const result = processReqMessages(model, mockMessages)

    // Expected result should have empty messages inserted between consecutive messages of the same role
    expect(result.length).toBe(9)
    expect(result[0]).toEqual({
      role: 'user',
      content: 'First question'
    })
    expect(result[1]).toEqual({
      role: 'assistant',
      content: ''
    })
    expect(result[2]).toEqual({
      role: 'user',
      content: 'Additional context'
    })
    expect(result[3]).toEqual({
      role: 'assistant',
      content: 'First answer'
    })
    expect(result[4]).toEqual({
      role: 'user',
      content: ''
    })
    expect(result[5]).toEqual({
      role: 'assistant',
      content: 'Additional information'
    })
    expect(result[6]).toEqual({
      role: 'user',
      content: 'Second question'
    })
    expect(result[7]).toEqual({
      role: 'assistant',
      content: 'Second answer'
    })
  })

  it('should not modify messages for other models', () => {
    const model = { id: 'gpt-4', provider: 'test', name: 'Test Model', group: 'Test' }
    const result = processReqMessages(model, mockMessages)

    expect(result.length).toBe(mockMessages.length)
    expect(result).toEqual(mockMessages)
  })

  it('should handle empty messages array', () => {
    const model = { id: 'deepseek-reasoner', provider: 'test', name: 'Test Model', group: 'Test' }
    const result = processReqMessages(model, [])

    expect(result.length).toBe(0)
    expect(result).toEqual([])
  })

  it('should handle single message', () => {
    const model = { id: 'deepseek-reasoner', provider: 'test', name: 'Test Model', group: 'Test' }
    const singleMessage = [{ role: 'user', content: 'Single message' }] as ChatCompletionMessageParam[]
    const result = processReqMessages(model, singleMessage)

    expect(result.length).toBe(1)
    expect(result).toEqual(singleMessage)
  })

  it('should handle alternating roles correctly', () => {
    const model = { id: 'deepseek-reasoner', provider: 'test', name: 'Test Model', group: 'Test' }
    const alternatingMessages = [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
      { role: 'assistant', content: 'A2' }
    ] as ChatCompletionMessageParam[]

    const result = processReqMessages(model, alternatingMessages)

    // Alternating roles should remain unchanged
    expect(result.length).toBe(4)
    expect(result).toEqual(alternatingMessages)
  })

  it('should handle messages with empty content', () => {
    const model = { id: 'deepseek-reasoner', provider: 'test', name: 'Test Model', group: 'Test' }
    const messagesWithEmpty = [
      { role: 'user', content: 'Q1' },
      { role: 'user', content: '' },
      { role: 'user', content: 'Q2' }
    ] as ChatCompletionMessageParam[]

    const result = processReqMessages(model, messagesWithEmpty)

    // Should insert empty assistant messages between consecutive user messages
    expect(result.length).toBe(5)
    expect(result[0]).toEqual({ role: 'user', content: 'Q1' })
    expect(result[1]).toEqual({ role: 'assistant', content: '' })
    expect(result[2]).toEqual({ role: 'user', content: '' })
    expect(result[3]).toEqual({ role: 'assistant', content: '' })
    expect(result[4]).toEqual({ role: 'user', content: 'Q2' })
  })
})

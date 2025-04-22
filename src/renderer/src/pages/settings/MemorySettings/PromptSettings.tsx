import { InfoCircleOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  saveMemoryData,
  setAssistantMemoryPrompt,
  setContextualMemoryPrompt,
  setHistoricalContextPrompt,
  setLongTermMemoryPrompt,
  setShortTermMemoryPrompt
} from '@renderer/store/memory'
// Remove Tabs from import as it's no longer used after removing TabPane
import { Button, Input, Tooltip, Typography } from 'antd'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingGroup, SettingHelpText, SettingTitle } from '..'

const { TextArea } = Input
const { Text } = Typography
// Remove unused TabPane destructuring

// 默认提示词
const DEFAULT_LONG_TERM_MEMORY_PROMPT = `
你是一个专业的对话分析专家，负责从对话中提取关键信息，形成精准的长期记忆。

## 输出格式要求（非常重要）：
你必须严格按照以下格式输出每条提取的信息：
类别: 信息内容

有效的类别包括：
- 用户偏好
- 技术需求
- 个人信息
- 交互偏好
- 其他

每行必须包含一个类别和一个信息内容，用冒号分隔。
不符合此格式的输出将被视为无效。

示例输出：
用户偏好: 用户喜欢简洁直接的代码修改方式。
技术需求: 用户需要修复长期记忆分析功能中的问题。
个人信息: 用户自称是彭于晏，一位知名演员。
交互偏好: 用户倾向于简短直接的问答方式。
其他: 用户对AI记忆功能的工作原理很感兴趣。

## 分析要求：
请仔细分析对话内容，提取出重要的用户信息，这些信息在未来的对话中可能有用。
提取的信息必须具体、明确且有实际价值。
避免过于宽泛或模糊的描述。

## 最终检查（非常重要）：
1. 确保每行输出都严格遵循"类别: 信息内容"格式
2. 确保使用的类别是上述五个类别之一
3. 如果没有找到重要信息，请返回空字符串
4. 不要输出任何其他解释或评论
`

const DEFAULT_SHORT_TERM_MEMORY_PROMPT = `
请对以下对话内容进行非常详细的分析和总结，提取对当前对话至关重要的上下文信息。请注意，这个分析将用于生成短期记忆，帮助AI理解当前对话的完整上下文。

分析要求：
1. 非常详细地总结用户的每一句话中表达的关键信息、需求和意图
2. 全面分析AI回复中的重要内容和对用户问题的解决方案
3. 详细记录对话中的重要事实、数据、代码示例和具体细节
4. 清晰捕捉对话的逻辑发展、转折点和关键决策
5. 提取对理解当前对话上下文必不可少的信息
6. 记录用户提出的具体问题和关注点
7. 捕捉用户在对话中表达的偏好、困惑和反馈
8. 记录对话中提到的文件、路径、变量名等具体技术细节

与长期记忆不同，短期记忆应该非常详细地关注当前对话的具体细节和上下文。每条短期记忆应该是对对话片段的精准总结，确保不遗漏任何重要信息。

请注意，对于长对话（超过5万字），您应该生成至少15-20条详细的记忆条目，确保完整捕捉对话的所有重要方面。对于超长对话（超过8万字），应生成至少20-30条记忆条目。
`

const DEFAULT_ASSISTANT_MEMORY_PROMPT = `
请分析以下对话内容，提取对助手需要长期记住的重要信息。这些信息将作为助手的记忆，帮助助手在未来的对话中更好地理解用户和提供个性化服务。

请注意以下几点：
1. 提取的信息应该是对助手提供服务有帮助的，例如用户偏好、习惯、背景信息等
2. 每条记忆应该简洁明了，一句话表达一个完整的信息点
3. 记忆应该是事实性的，不要包含推测或不确定的信息
4. 记忆应该是有用的，能够帮助助手在未来的对话中更好地服务用户
5. 不要重复已有的记忆内容

请以JSON数组格式返回提取的记忆，每条记忆是一个字符串。例如：
["用户喜欢简洁的回答", "用户对技术话题特别感兴趣", "用户希望得到具体的代码示例"]
`

const DEFAULT_CONTEXTUAL_MEMORY_PROMPT = `
请分析以下对话内容，提取出关键信息和主题，以便我可以找到相关的记忆。

请提供：
1. 对话的主要主题
2. 用户可能关心的关键信息点
3. 可能与此对话相关的背景知识或上下文

请以简洁的关键词和短语形式回答，每行一个要点，不要使用编号或项目符号。
`

const DEFAULT_HISTORICAL_CONTEXT_PROMPT = `
你是一个专门分析对话上下文的助手，你的任务是判断当前对话是否需要引用历史对话来提供更完整、更连贯的回答。

最近的对话内容:
[对话内容]

可用的历史对话摘要:
[历史对话摘要]

请仔细分析用户的问题和可用的历史对话摘要。考虑以下因素：

1. 用户当前问题是否与历史对话中的任何主题相关
2. 历史对话中是否包含可能对当前问题有帮助的信息
3. 引用历史对话是否能使回答更全面、更个性化
4. 即使用户没有直接提及历史内容，但如果历史对话中有相关信息，也应考虑引用

请积极地寻找可能的联系，即使联系不是非常明显的。如果有任何可能相关的历史对话，请倾向于引用它。

请回答以下问题:
1. 是否需要引用历史对话来更好地回答用户的问题？(是/否)
2. 如果需要，请指出最相关的历史对话的话题ID。
3. 详细解释为什么需要引用这个历史对话，以及它如何与当前问题相关。

请按以下JSON格式回答，不要添加任何其他文本:
{
  "needsHistoricalContext": true/false,
  "selectedTopicId": "话题ID或null",
  "reason": "详细解释为什么需要或不需要引用历史对话"
}
`

// Remove unused TabContainer definition

const StyledTextArea = styled(TextArea)`
  font-family: monospace;
  margin-bottom: 16px;
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
`

const PromptSettingItem = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
`

const PromptSettingTitle = styled.div`
  font-weight: 500;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const PromptSettingDescription = styled(Text)`
  margin-bottom: 8px;
`

const PromptSettings: FC = () => {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()

  // 从Redux获取提示词
  const longTermMemoryPrompt = useAppSelector((state) => state.memory.longTermMemoryPrompt)
  const shortTermMemoryPrompt = useAppSelector((state) => state.memory.shortTermMemoryPrompt)
  const assistantMemoryPrompt = useAppSelector((state) => state.memory.assistantMemoryPrompt)
  const contextualMemoryPrompt = useAppSelector((state) => state.memory.contextualMemoryPrompt)
  const historicalContextPrompt = useAppSelector((state) => state.memory.historicalContextPrompt)

  // 本地状态
  const [longTermPrompt, setLongTermPrompt] = useState(longTermMemoryPrompt || DEFAULT_LONG_TERM_MEMORY_PROMPT)
  const [shortTermPrompt, setShortTermPrompt] = useState(shortTermMemoryPrompt || DEFAULT_SHORT_TERM_MEMORY_PROMPT)
  const [assistantPrompt, setAssistantPrompt] = useState(assistantMemoryPrompt || DEFAULT_ASSISTANT_MEMORY_PROMPT)
  const [contextualPrompt, setContextualPrompt] = useState(contextualMemoryPrompt || DEFAULT_CONTEXTUAL_MEMORY_PROMPT)
  const [historicalPrompt, setHistoricalPrompt] = useState(historicalContextPrompt || DEFAULT_HISTORICAL_CONTEXT_PROMPT)

  // 保存提示词
  const handleSaveLongTermPrompt = async () => {
    dispatch(setLongTermMemoryPrompt(longTermPrompt))
    await dispatch(saveMemoryData({ longTermMemoryPrompt: longTermPrompt }))
    window.message.success(t('settings.memory.promptSettings.promptSaved') || '提示词已保存')
  }

  const handleSaveShortTermPrompt = async () => {
    dispatch(setShortTermMemoryPrompt(shortTermPrompt))
    await dispatch(saveMemoryData({ shortTermMemoryPrompt: shortTermPrompt }))
    window.message.success(t('settings.memory.promptSettings.promptSaved') || '提示词已保存')
  }

  const handleSaveAssistantPrompt = async () => {
    dispatch(setAssistantMemoryPrompt(assistantPrompt))
    await dispatch(saveMemoryData({ assistantMemoryPrompt: assistantPrompt }))
    window.message.success(t('settings.memory.promptSettings.promptSaved') || '提示词已保存')
  }

  const handleSaveContextualPrompt = async () => {
    dispatch(setContextualMemoryPrompt(contextualPrompt))
    await dispatch(saveMemoryData({ contextualMemoryPrompt: contextualPrompt }))
    window.message.success(t('settings.memory.promptSettings.promptSaved') || '提示词已保存')
  }

  const handleSaveHistoricalPrompt = async () => {
    dispatch(setHistoricalContextPrompt(historicalPrompt))
    await dispatch(saveMemoryData({ historicalContextPrompt: historicalPrompt }))
    window.message.success(t('settings.memory.promptSettings.promptSaved') || '提示词已保存')
  }

  // 重置提示词
  const handleResetLongTermPrompt = () => {
    setLongTermPrompt(DEFAULT_LONG_TERM_MEMORY_PROMPT)
    dispatch(setLongTermMemoryPrompt(null))
    dispatch(saveMemoryData({ longTermMemoryPrompt: null }))
    window.message.success(t('settings.memory.promptSettings.promptReset') || '提示词已重置')
  }

  const handleResetShortTermPrompt = () => {
    setShortTermPrompt(DEFAULT_SHORT_TERM_MEMORY_PROMPT)
    dispatch(setShortTermMemoryPrompt(null))
    dispatch(saveMemoryData({ shortTermMemoryPrompt: null }))
    window.message.success(t('settings.memory.promptSettings.promptReset') || '提示词已重置')
  }

  const handleResetAssistantPrompt = () => {
    setAssistantPrompt(DEFAULT_ASSISTANT_MEMORY_PROMPT)
    dispatch(setAssistantMemoryPrompt(null))
    dispatch(saveMemoryData({ assistantMemoryPrompt: null }))
    window.message.success(t('settings.memory.promptSettings.promptReset') || '提示词已重置')
  }

  const handleResetContextualPrompt = () => {
    setContextualPrompt(DEFAULT_CONTEXTUAL_MEMORY_PROMPT)
    dispatch(setContextualMemoryPrompt(null))
    dispatch(saveMemoryData({ contextualMemoryPrompt: null }))
    window.message.success(t('settings.memory.promptSettings.promptReset') || '提示词已重置')
  }

  const handleResetHistoricalPrompt = () => {
    setHistoricalPrompt(DEFAULT_HISTORICAL_CONTEXT_PROMPT)
    dispatch(setHistoricalContextPrompt(null))
    dispatch(saveMemoryData({ historicalContextPrompt: null }))
    window.message.success(t('settings.memory.promptSettings.promptReset') || '提示词已重置')
  }

  return (
    <SettingGroup>
      <SettingTitle>
        {t('settings.memory.promptSettings.title') || '提示词设置'}
        <Tooltip title={t('settings.memory.promptSettings.description') || '自定义记忆分析使用的提示词'}>
          <InfoCircleOutlined style={{ marginLeft: 8 }} />
        </Tooltip>
      </SettingTitle>
      <SettingHelpText>
        {t('settings.memory.promptSettings.description') ||
          '自定义记忆分析使用的提示词，可以根据需要调整分析的方式和结果。'}
      </SettingHelpText>

      {/* 长期记忆提示词 */}
      <PromptSettingItem>
        <PromptSettingTitle>
          {t('settings.memory.promptSettings.longTermMemoryPrompt') || '长期记忆提示词'}
          <ButtonGroup>
            <Button type="primary" onClick={handleSaveLongTermPrompt}>
              {t('settings.memory.promptSettings.savePrompt') || '保存提示词'}
            </Button>
            <Button onClick={handleResetLongTermPrompt}>
              {t('settings.memory.promptSettings.resetToDefault') || '重置为默认值'}
            </Button>
          </ButtonGroup>
        </PromptSettingTitle>
        <PromptSettingDescription type="secondary">
          {t('settings.memory.promptSettings.longTermPromptDescription') ||
            '长期记忆分析提示词用于从对话中提取用户的长期偏好、习惯和背景信息。'}
        </PromptSettingDescription>
        <StyledTextArea
          value={longTermPrompt}
          onChange={(e) => setLongTermPrompt(e.target.value)}
          rows={15}
          placeholder={t('settings.memory.promptSettings.enterPrompt') || '输入提示词...'}
        />
      </PromptSettingItem>

      {/* 短期记忆提示词 */}
      <PromptSettingItem>
        <PromptSettingTitle>
          {t('settings.memory.promptSettings.shortTermMemoryPrompt') || '短期记忆提示词'}
          <ButtonGroup>
            <Button type="primary" onClick={handleSaveShortTermPrompt}>
              {t('settings.memory.promptSettings.savePrompt') || '保存提示词'}
            </Button>
            <Button onClick={handleResetShortTermPrompt}>
              {t('settings.memory.promptSettings.resetToDefault') || '重置为默认值'}
            </Button>
          </ButtonGroup>
        </PromptSettingTitle>
        <PromptSettingDescription type="secondary">
          {t('settings.memory.promptSettings.shortTermPromptDescription') ||
            '短期记忆分析提示词用于从当前对话中提取重要的上下文信息，帮助AI理解对话的连贯性。'}
        </PromptSettingDescription>
        <StyledTextArea
          value={shortTermPrompt}
          onChange={(e) => setShortTermPrompt(e.target.value)}
          rows={15}
          placeholder={t('settings.memory.promptSettings.enterPrompt') || '输入提示词...'}
        />
      </PromptSettingItem>

      {/* 上下文记忆提示词 */}
      <PromptSettingItem>
        <PromptSettingTitle>
          {t('settings.memory.promptSettings.contextualMemoryPrompt') || '上下文记忆提示词'}
          <ButtonGroup>
            <Button type="primary" onClick={handleSaveContextualPrompt}>
              {t('settings.memory.promptSettings.savePrompt') || '保存提示词'}
            </Button>
            <Button onClick={handleResetContextualPrompt}>
              {t('settings.memory.promptSettings.resetToDefault') || '重置为默认值'}
            </Button>
          </ButtonGroup>
        </PromptSettingTitle>
        <PromptSettingDescription type="secondary">
          {t('settings.memory.promptSettings.contextualPromptDescription') ||
            '上下文记忆分析提示词用于从当前对话中提取关键主题和信息点，以便找到相关的记忆。'}
        </PromptSettingDescription>
        <StyledTextArea
          value={contextualPrompt}
          onChange={(e) => setContextualPrompt(e.target.value)}
          rows={15}
          placeholder={t('settings.memory.promptSettings.enterPrompt') || '输入提示词...'}
        />
      </PromptSettingItem>

      {/* 助手记忆提示词 */}
      <PromptSettingItem>
        <PromptSettingTitle>
          {t('settings.memory.promptSettings.assistantMemoryPrompt') || '助手记忆提示词'}
          <ButtonGroup>
            <Button type="primary" onClick={handleSaveAssistantPrompt}>
              {t('settings.memory.promptSettings.savePrompt') || '保存提示词'}
            </Button>
            <Button onClick={handleResetAssistantPrompt}>
              {t('settings.memory.promptSettings.resetToDefault') || '重置为默认值'}
            </Button>
          </ButtonGroup>
        </PromptSettingTitle>
        <PromptSettingDescription type="secondary">
          {t('settings.memory.promptSettings.assistantPromptDescription') ||
            '助手记忆分析提示词用于提取与特定助手相关的用户偏好和需求。'}
        </PromptSettingDescription>
        <StyledTextArea
          value={assistantPrompt}
          onChange={(e) => setAssistantPrompt(e.target.value)}
          rows={15}
          placeholder={t('settings.memory.promptSettings.enterPrompt') || '输入提示词...'}
        />
      </PromptSettingItem>

      {/* 历史上下文提示词 */}
      <PromptSettingItem>
        <PromptSettingTitle>
          {t('settings.memory.promptSettings.historicalContextPrompt') || '历史上下文提示词'}
          <ButtonGroup>
            <Button type="primary" onClick={handleSaveHistoricalPrompt}>
              {t('settings.memory.promptSettings.savePrompt') || '保存提示词'}
            </Button>
            <Button onClick={handleResetHistoricalPrompt}>
              {t('settings.memory.promptSettings.resetToDefault') || '重置为默认值'}
            </Button>
          </ButtonGroup>
        </PromptSettingTitle>
        <PromptSettingDescription type="secondary">
          {t('settings.memory.promptSettings.historicalPromptDescription') ||
            '历史上下文分析提示词用于判断当前对话是否需要引用历史对话来提供更完整的回答。'}
        </PromptSettingDescription>
        <StyledTextArea
          value={historicalPrompt}
          onChange={(e) => setHistoricalPrompt(e.target.value)}
          rows={15}
          placeholder={t('settings.memory.promptSettings.enterPrompt') || '输入提示词...'}
        />
      </PromptSettingItem>
    </SettingGroup>
  )
}

export default PromptSettings

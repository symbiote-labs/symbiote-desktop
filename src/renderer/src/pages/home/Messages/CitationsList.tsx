import { DownOutlined, InfoCircleOutlined, UpOutlined } from '@ant-design/icons'
import Favicon from '@renderer/components/Icons/FallbackFavicon'
import { HStack } from '@renderer/components/Layout'
import React, { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Citation {
  number: number
  url: string
  title?: string
  hostname?: string
  showFavicon?: boolean
}

interface CitationsListProps {
  citations: Citation[]
}

const CitationsList: React.FC<CitationsListProps> = ({ citations }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  // 使用 useMemo 记忆化列表渲染结果，避免不必要的重新计算
  const renderedCitations = useMemo(() => {
    if (!citations || citations.length === 0) return []

    return citations.map((citation) => (
      <HStack key={citation.url || citation.number} style={{ alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>{citation.number}.</span>
        {citation.showFavicon && citation.url && (
          <Favicon hostname={new URL(citation.url).hostname} alt={citation.title || citation.hostname || ''} />
        )}
        <CitationLink href={citation.url} className="text-nowrap" target="_blank" rel="noopener noreferrer">
          {citation.title ? citation.title : <span className="hostname">{citation.hostname}</span>}
        </CitationLink>
      </HStack>
    ))
  }, [citations])

  // 创建折叠面板的标题
  const collapseTitle = (
    <CitationsTitle onClick={(e) => e.stopPropagation()}>
      {t('message.citations')} ({citations.length})
      <InfoCircleOutlined style={{ fontSize: '14px', marginLeft: '4px', opacity: 0.6 }} />
    </CitationsTitle>
  )

  // 如果没有引用，不渲染任何内容
  if (!citations || citations.length === 0) return null

  return (
    <CitationsContainer className="footnotes">
      <CollapseTitleBar $isExpanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)}>
        {collapseTitle}
        <CollapseIcon>{isExpanded ? <UpOutlined /> : <DownOutlined />}</CollapseIcon>
      </CollapseTitleBar>
      <CollapseContent $isExpanded={isExpanded}>{renderedCitations}</CollapseContent>
    </CitationsContainer>
  )
}

const CitationsContainer = styled.div`
  background-color: rgb(242, 247, 253);
  border-radius: 4px;
  margin: 12px 0;
  display: flex;
  flex-direction: column;

  body[theme-mode='dark'] & {
    background-color: rgba(255, 255, 255, 0.05);
  }
`

const CollapseTitleBar = styled.div<{ $isExpanded: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  border-bottom: ${(props) => (props.$isExpanded ? '1px solid var(--color-border)' : 'none')};

  &:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }

  body[theme-mode='dark'] &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
`

const CollapseContent = styled.div<{ $isExpanded: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: ${(props) => (props.$isExpanded ? '8px 12px' : '0')};
  max-height: ${(props) => (props.$isExpanded ? '300px' : '0')};
  overflow: ${(props) => (props.$isExpanded ? 'auto' : 'hidden')};
  opacity: ${(props) => (props.$isExpanded ? '1' : '0')};
  transition: all 0.3s ease;
`

const CollapseIcon = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  justify-content: center;
`

const CitationsTitle = styled.div`
  font-weight: 500;
  color: var(--color-text-1);
  display: flex;
  align-items: center;
`

const CitationLink = styled.a`
  font-size: 14px;
  line-height: 1.6;
  text-decoration: none;
  color: var(--color-text-1);

  .hostname {
    color: var(--color-link);
  }

  &:hover {
    text-decoration: underline;
  }
`

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(CitationsList)

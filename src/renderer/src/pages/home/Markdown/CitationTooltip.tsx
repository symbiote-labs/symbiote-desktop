import Favicon from '@renderer/components/Icons/FallbackFavicon'
import { Tooltip } from 'antd'
import React from 'react'
import styled from 'styled-components'

interface CitationTooltipProps {
  children: React.ReactNode
  citation: {
    url: string
    title?: string
    content?: string
  }
}

const CitationTooltip: React.FC<CitationTooltipProps> = ({ children, citation }) => {
  // 确保citation对象有效
  const safeCitation = {
    url: citation?.url || '#',
    title: citation?.title || '',
    content: citation?.content || ''
  }

  let hostname = ''
  try {
    // 只有当URL是有效的网址时才尝试解析
    if (safeCitation.url && safeCitation.url.startsWith('http')) {
      hostname = new URL(safeCitation.url).hostname
    } else {
      hostname = safeCitation.url
    }
  } catch {
    hostname = safeCitation.url
  }

  // 添加点击处理函数
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Citation clicked:', safeCitation)

    // 如果是锚点链接，滚动到页面对应位置
    if (safeCitation.url.startsWith('#')) {
      const element = document.querySelector(safeCitation.url)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // 否则打开外部链接
      window.open(safeCitation.url, '_blank')
    }
  }

  // 自定义悬浮卡片内容
  const tooltipContent = (
    <TooltipContentWrapper>
      <TooltipHeader onClick={() => window.open(safeCitation.url, '_blank')}>
        <Favicon hostname={hostname} alt={safeCitation.title || hostname} />
        <TooltipTitle title={safeCitation.title || hostname}>{safeCitation.title || hostname}</TooltipTitle>
      </TooltipHeader>
      {safeCitation.content && <TooltipBody>{safeCitation.content}</TooltipBody>}
      <TooltipFooter onClick={() => window.open(safeCitation.url, '_blank')}>{hostname}</TooltipFooter>
    </TooltipContentWrapper>
  )

  // 克隆子元素并添加点击事件
  const childrenWithProps = React.Children.map(children, (child) => {
    // 确保是React元素
    if (React.isValidElement(child)) {
      // 使用类型断言来处理 props 类型问题
      return React.cloneElement(child, {
        onClick: handleClick,
        style: {
          ...(child.props as any).style,
          cursor: 'pointer',
          color: 'var(--color-link)'
        }
      } as React.HTMLAttributes<HTMLElement>)
    }
    return child
  })

  return (
    <StyledTooltip
      title={tooltipContent}
      placement="top"
      arrow={false}
      overlayInnerStyle={{
        backgroundColor: 'var(--color-background-mute)',
        border: '1px solid var(--color-border)',
        padding: 0,
        borderRadius: '8px'
      }}>
      <ClickableSpan onClick={handleClick}>{childrenWithProps}</ClickableSpan>
    </StyledTooltip>
  )
}

// 使用styled-components来自定义Tooltip的样式，包括箭头
const StyledTooltip = styled(Tooltip)`
  .ant-tooltip-arrow {
    .ant-tooltip-arrow-content {
      background-color: var(--color-background-1);
    }
  }
`

const TooltipContentWrapper = styled.div`
  padding: 12px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
`

const TooltipHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;

  &:hover {
    opacity: 0.8;
  }
`

const TooltipTitle = styled.div`
  color: var(--color-text-1);
  font-size: 14px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const TooltipBody = styled.div`
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 8px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  color: var(--color-text-2);
`

const TooltipFooter = styled.div`
  font-size: 12px;
  color: var(--color-link);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

const ClickableSpan = styled.span`
  cursor: pointer;
  display: inline-block;
  color: var(--color-link);

  sup {
    color: var(--color-link);
    font-size: 0.75em;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
    top: -0.5em;
  }
`

export default CitationTooltip

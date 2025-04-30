import { FC, ReactNode } from 'react'
import styled from 'styled-components'

interface ThreeColumnLayoutProps {
  leftColumn: ReactNode
  middleColumn: ReactNode
  rightColumn: ReactNode
}

const ThreeColumnLayout: FC<ThreeColumnLayoutProps> = ({ leftColumn, middleColumn, rightColumn }) => {
  return (
    <Container>
      <LeftColumn>{leftColumn}</LeftColumn>
      <MiddleColumn>{middleColumn}</MiddleColumn>
      <RightColumn>{rightColumn}</RightColumn>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  width: 100%;
  height: calc(100vh - var(--navbar-height));
  overflow: hidden;
  background-color: var(--color-background-soft);
`

const LeftColumn = styled.div`
  width: 20%;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  background-color: var(--color-background-soft);
`

const MiddleColumn = styled.div`
  width: 70%;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  background-color: var(--color-background-soft);
`

const RightColumn = styled.div`
  width: 10%;
  min-width: 85px;
  overflow-y: auto;
  padding: 12px 0;
  background-color: var(--color-background-soft);
  box-shadow: -1px 0 3px rgba(0, 0, 0, 0.05);

  /* 确保所有内容都能正确显示，不会溢出 */
  .ant-form-item-control-input {
    width: 100%;
    overflow-x: auto;
  }

  .ant-input,
  .ant-input-textarea {
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .ant-descriptions-item-content {
    word-break: break-word;
    overflow-wrap: break-word;
  }

  pre,
  code {
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* 添加水平滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-primary);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
`

export default ThreeColumnLayout

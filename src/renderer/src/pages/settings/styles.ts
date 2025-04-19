import { ThemeMode } from '@renderer/types'
import styled from 'styled-components'

export const SettingContainer = styled.div<{ theme: ThemeMode }>`
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  background-color: ${(props) => (props.theme === 'dark' ? 'var(--color-bg-1)' : 'var(--color-bg-1)')};
`

export const SettingGroup = styled.div<{ theme: ThemeMode }>`
  margin-bottom: 20px;
  padding: 20px;
  border-radius: 8px;
  background-color: ${(props) => (props.theme === 'dark' ? 'var(--color-bg-2)' : 'var(--color-bg-2)')};
`

export const SettingTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-1);
`

export const SettingDivider = styled.div`
  height: 1px;
  background-color: var(--color-border);
  margin: 15px 0;
`

export const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 15px 0;
`

export const SettingRowTitle = styled.div`
  font-size: 14px;
  color: var(--color-text-1);
`

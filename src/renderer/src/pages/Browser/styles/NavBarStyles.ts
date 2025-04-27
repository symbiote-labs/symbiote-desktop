import { Input } from 'antd'
import styled from 'styled-components'

export const UrlBarContainer = styled.div`
  position: relative;
  flex: 1;
  margin: 0 12px;
  max-width: calc(75% - 320px);
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag; /* 添加这个属性使输入框可交互 */
`

export const SecurityIndicator = styled.div<{ $isSecure: boolean }>`
  position: absolute;
  left: 8px;
  z-index: 2;
  color: ${({ $isSecure }) => ($isSecure ? '#52c41a' : '#ff4d4f')};
  -webkit-app-region: no-drag; /* 确保安全指示器也可交互 */
`

export const ErrorIndicator = styled.div`
  position: absolute;
  right: 8px;
  color: #ff4d4f;
  cursor: pointer;
  -webkit-app-region: no-drag; /* 确保错误图标可交互 */
`

export const NavBarButtonGroup = styled.div`
  -webkit-app-region: no-drag;
`

export const UrlInput = styled(Input)`
  padding-left: 30px;
`

import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import BarLoader from 'react-spinners/BarLoader'
import styled, { css } from 'styled-components'

export default function SearchingSpinner() {
  const { t } = useTranslation()
  return (
    <SearchingContainer>
      <Search size={24} />
      <SearchingText>{t('message.searching')}</SearchingText>
      <BarLoader color="#1677ff" />
    </SearchingContainer>
  )
}

const baseContainer = css`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const SearchingContainer = styled.div`
  ${baseContainer}
  background-color: var(--color-background-mute);
  padding: 10px;
  border-radius: 10px;
  margin-bottom: 10px;
  gap: 10px;
`

const SearchingText = styled.div`
  font-size: 14px;
  line-height: 1.6;
  text-decoration: none;
  color: var(--color-text-1);
`

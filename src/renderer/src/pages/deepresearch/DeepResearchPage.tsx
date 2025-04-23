import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import DeepResearchPanel from '../../components/DeepResearch'

const DeepResearchPage: React.FC = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <Navbar>
        <NavbarCenter>{t('deepresearch.title', 'Deep Research')}</NavbarCenter>
      </Navbar>
      <Content>
        <DeepResearchPanel />
      </Content>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`

const Content = styled.div`
  flex: 1;
  overflow: auto;
  padding: 0;
`

export default DeepResearchPage

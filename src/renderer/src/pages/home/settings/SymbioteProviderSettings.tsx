import { PlusOutlined } from '@ant-design/icons'
import Scrollbar from '@renderer/components/Scrollbar'
import { getProviderLogo } from '@renderer/config/providers'
import { useAllProviders, useProviders } from '@renderer/hooks/useProvider'
import { Provider } from '@renderer/types'
import { generateColorFromChar, getFirstCharacter } from '@renderer/utils'
import { Avatar, Button, Input, Tag } from 'antd'
import { Search } from 'lucide-react'
import { FC, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { v4 as uuid } from 'uuid'

import AddProviderPopup from '../../settings/ProviderSettings/AddProviderPopup'
import ProviderSetting from '../../settings/ProviderSettings/ProviderSetting'

// Curated list of essential providers for Symbiote
const SYMBIOTE_PROVIDER_IDS = [
  'anthropic',
  'gemini', // Google provider is stored as 'gemini' in the system
  'azure-openai',
  'symbiote-labs'
]

const SymbioteProviderSettings: FC = () => {
  const [searchParams] = useSearchParams()
  const allProviders = useAllProviders()
  const { addProvider, updateProviders } = useProviders()
  const [selectedProvider, setSelectedProvider] = useState<Provider>()
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState<string>('')

  // Memoize the filtered providers to prevent infinite re-renders
  const symbioteProviders = useMemo(() => {
    return allProviders.filter(provider =>
      SYMBIOTE_PROVIDER_IDS.includes(provider.id)
    )
  }, [allProviders])

  // Debug logging effect
  useEffect(() => {
    console.log('All providers count:', allProviders.length)
    console.log('All provider IDs:', allProviders.map(p => p.id))
    console.log('All providers:', allProviders.map(p => ({ id: p.id, name: p.name, enabled: p.enabled })))
    console.log('Symbiote providers:', symbioteProviders.map(p => ({ id: p.id, name: p.name, enabled: p.enabled })))
    console.log('Looking for these provider IDs:', SYMBIOTE_PROVIDER_IDS)

    // Debug: Check if symbiote-labs exists in all providers
    const symbioteLabsProvider = allProviders.find(p => p.id === 'symbiote-labs')
    console.log('Symbiote Labs provider found:', symbioteLabsProvider)

    // Debug: Check if each expected provider exists
    SYMBIOTE_PROVIDER_IDS.forEach(id => {
      const provider = allProviders.find(p => p.id === id)
      console.log(`Provider ${id}:`, provider ? 'FOUND' : 'MISSING')
    })

    // Debug: Check models for symbiote-labs provider
    if (symbioteLabsProvider) {
      console.log('Symbiote Labs models:', symbioteLabsProvider.models)
    }
  }, [allProviders, symbioteProviders])

  // Separate effect for ensuring providers are enabled
  useEffect(() => {
    if (allProviders.length === 0) return // Wait for providers to load

    // Ensure key providers are enabled
    const updatedProviders = allProviders.map(provider => {
      if (SYMBIOTE_PROVIDER_IDS.includes(provider.id)) {
        return { ...provider, enabled: true }
      }
      return provider
    })

    // Only update if there are changes to avoid infinite loops
    const hasChanges = updatedProviders.some((updated, index) =>
      updated.enabled !== allProviders[index].enabled
    )

    if (hasChanges) {
      console.log('Enabling symbiote providers')
      updateProviders(updatedProviders)
    }
  }, [allProviders, updateProviders])

  // Separate effect for initial provider selection (only runs once when providers are loaded)
  useEffect(() => {
    if (symbioteProviders.length === 0 || selectedProvider) return // Wait for providers or don't override existing selection

    const providerId = searchParams.get('id')
    if (providerId) {
      const provider = symbioteProviders.find((p) => p.id === providerId)
      if (provider) {
        console.log('Setting selected provider from URL:', provider.id)
        setSelectedProvider(provider)
        return
      }
    }

    // Set to first available provider only if no provider is selected
    if (symbioteProviders[0]) {
      console.log('No URL param, setting first provider:', symbioteProviders[0].id)
      setSelectedProvider(symbioteProviders[0])
    }
  }, [symbioteProviders, searchParams]) // Remove selectedProvider from deps to prevent infinite loop

  const onAddProvider = () => {
    AddProviderPopup.show().then((newProvider) => {
      if (newProvider) {
        const provider: Provider = {
          id: uuid(),
          name: newProvider.name,
          type: newProvider.type as any,
          apiKey: '',
          apiHost: '',
          models: [],
          isSystem: false,
          enabled: true
        }
        addProvider(provider)
      }
    })
  }

  const onProviderClick = (provider: Provider) => {
    console.log('Provider clicked:', provider.id, provider.name)
    setSelectedProvider(provider)
  }

  const getProviderAvatar = (provider: Provider) => {
    const logo = getProviderLogo(provider.id)
    if (logo) {
      return <ProviderLogo src={logo} />
    }
    return (
      <ProviderLogo style={{ backgroundColor: generateColorFromChar(getFirstCharacter(provider.name)) }}>
        {getFirstCharacter(provider.name)}
      </ProviderLogo>
    )
  }

  const filteredProviders = symbioteProviders.filter((provider) => {
    const providerName = provider.isSystem ? t(`provider.${provider.id}`) : provider.name

    const isProviderMatch =
      provider.id.toLowerCase().includes(searchText.toLowerCase()) ||
      providerName.toLowerCase().includes(searchText.toLowerCase())

    const isModelMatch = provider.models.some((model) => {
      return (
        model.id.toLowerCase().includes(searchText.toLowerCase()) ||
        model.name.toLowerCase().includes(searchText.toLowerCase())
      )
    })

    return isProviderMatch || isModelMatch
  })

  if (!selectedProvider) {
    return null
  }

  return (
    <Container className="selectable">
      <ProviderListContainer>
        <AddButtonWrapper>
          <Input
            type="text"
            placeholder={t('settings.provider.search')}
            value={searchText}
            style={{ borderRadius: 'var(--list-item-border-radius)', height: 35 }}
            suffix={<Search size={14} />}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchText('')
              }
            }}
            allowClear
          />
        </AddButtonWrapper>
        <Scrollbar>
          <ProviderList>
            {filteredProviders.map((provider) => (
              <ProviderListItem
                key={provider.id}
                className={provider.id === selectedProvider?.id ? 'active' : ''}
                onClick={() => onProviderClick(provider)}>
                {getProviderAvatar(provider)}
                <ProviderItemName className="text-nowrap">
                  {provider.isSystem ? t(`provider.${provider.id}`) : provider.name}
                </ProviderItemName>
                {SYMBIOTE_PROVIDER_IDS.includes(provider.id) && (
                  <Tag color="green" style={{ marginLeft: 'auto', marginRight: 0, borderRadius: 16 }}>
                    ON
                  </Tag>
                )}
              </ProviderListItem>
            ))}
          </ProviderList>
        </Scrollbar>
        <AddButtonWrapper>
          <Button
            style={{ width: '100%', borderRadius: 'var(--list-item-border-radius)' }}
            icon={<PlusOutlined />}
            onClick={onAddProvider}>
            {t('button.add')}
          </Button>
        </AddButtonWrapper>
      </ProviderListContainer>
      <ProviderSetting provider={selectedProvider} key={`provider-${selectedProvider.id}-${selectedProvider.enabled}`} />
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`

const ProviderListContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: calc(var(--settings-width) + 10px);
  height: calc(100vh - var(--navbar-height));
  border-right: 0.5px solid var(--color-border);
`

const ProviderList = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 8px;
  padding-right: 5px;
`

const ProviderListItem = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 5px 10px;
  width: 100%;
  cursor: pointer;
  border-radius: var(--list-item-border-radius);
  font-size: 14px;
  transition: all 0.2s ease-in-out;
  border: 0.5px solid transparent;
  margin-bottom: 5px;
  &:hover {
    background: var(--color-background-soft);
  }
  &.active {
    background: var(--color-background-soft);
    border: 0.5px solid var(--color-border);
    font-weight: bold !important;
  }
`

const ProviderLogo = styled(Avatar)`
  border: 0.5px solid var(--color-border);
`

const ProviderItemName = styled.div`
  margin-left: 10px;
  font-weight: 500;
`

const AddButtonWrapper = styled.div`
  height: 50px;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 10px 8px;
`

export default SymbioteProviderSettings
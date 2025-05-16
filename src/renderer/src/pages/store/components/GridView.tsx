import { AssistantItem, CherryStoreItem, CherryStoreType, MiniAppItem } from '@renderer/types/cherryStore'
import { Fragment, useMemo } from 'react'

import AssistantCard from './Assistant/AssistantCard'
import MiniAppCard from './MiniApp/MiniAppCard'

interface GridViewProps {
  items: CherryStoreItem[]
  selectedCategory: string
  className?: string
}

const CardComponent = (selectedCategory: string, item: CherryStoreItem) => {
  switch (selectedCategory) {
    case CherryStoreType.ASSISTANT:
      return <AssistantCard item={item as AssistantItem} />
    case CherryStoreType.MINI_APP:
      return <MiniAppCard item={item as MiniAppItem} />
    default:
      return null
  }
}

export function GridView({ items, selectedCategory }: GridViewProps) {
  const effectiveGridClass = useMemo(() => {
    let gridClass = 'columns-4 gap-4 '

    switch (selectedCategory) {
      case CherryStoreType.ASSISTANT:
        gridClass += '2xl:columns-6'
        break
      case CherryStoreType.MINI_APP:
        gridClass = 'grid grid-cols-8 gap-4 2xl:grid-cols-10'
        break
    }
    return gridClass
  }, [selectedCategory])

  return (
    <div className={effectiveGridClass}>
      {items.map((item) => (
        <Fragment key={item.id}>{CardComponent(selectedCategory, item)}</Fragment>
      ))}
    </div>
  )
}

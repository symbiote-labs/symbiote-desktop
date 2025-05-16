import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { Category, CherryStoreItem, SubCategoryItem } from '@renderer/types/cherryStore'
import { SidebarProvider } from '@renderer/ui/sidebar'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Import Context and the main Dialog Manager component
import { DialogManagerProvider } from './components/dialog/DialogManagerContext'
import Dialogs from './components/dialog/index'
import { StoreContent } from './components/StoreContent'
import { StoreSidebar } from './components/StoreSidebar'
import { loadAndFilterItems, loadCategories } from './data'

export default function StoreLayout() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all')
  const { t } = useTranslation()
  const { resourcesPath } = useRuntime()

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<CherryStoreItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const loadedCategories = await loadCategories(resourcesPath)
        setCategories(loadedCategories)
        if (loadedCategories.length > 0 && !selectedCategory) {
          setSelectedCategory(loadedCategories[0].id)
          setSelectedSubcategory(loadedCategories[0].items[0].id)
        }
      } catch (err) {
        console.error('Error in StoreLayout fetchCategories:', err)
        setError('Failed to load store categories. Check console for details.')
      } finally {
        setIsLoading(false)
      }
    }
    resourcesPath && fetchCategories()
  }, [resourcesPath])

  useEffect(() => {
    if (!selectedCategory) {
      setItems([])
      return
    }

    const fetchItems = async () => {
      try {
        setIsLoadingItems(true)
        setError(null)
        const filteredItems = await loadAndFilterItems(selectedCategory, selectedSubcategory, searchQuery)
        setItems(filteredItems)
      } catch (err) {
        console.error('Error in StoreLayout fetchItems:', err)
        setError('Failed to load store items. Check console for details.')
        setItems([])
      } finally {
        setIsLoadingItems(false)
      }
    }

    fetchItems()
  }, [selectedCategory, selectedSubcategory, searchQuery])

  const handleSelectCategory = (categoryId: string, subcategoryId: string, row?: SubCategoryItem) => {
    setSelectedCategory(categoryId)
    setSelectedSubcategory(subcategoryId)
    setSearchQuery(row?.name || '')
  }

  if (isLoading) {
    return <div className="p-4 text-center">Loading store categories...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>
  }
  console.log('categories', categories)
  return (
    <DialogManagerProvider>
      <div className="h-[calc(100vh_-_var(--navbar-height))] w-full">
        <Navbar className="h-full">
          <NavbarCenter>{t('store.title')}</NavbarCenter>
        </Navbar>
        <div id="content-container" className="h-full w-full">
          <SidebarProvider className="relative h-full min-h-full w-full">
            <StoreSidebar
              categories={categories}
              selectedCategory={selectedCategory}
              selectedSubcategory={selectedSubcategory}
              onSelectCategory={handleSelectCategory}
            />
            {isLoadingItems ? (
              // TODO: 添加 loading 动画
              <div className="p-4 text-center">Loading items...</div>
            ) : (
              <StoreContent
                viewMode={viewMode}
                searchQuery={searchQuery}
                selectedCategory={selectedCategory}
                items={items}
                onSearchQueryChange={setSearchQuery}
                onViewModeChange={setViewMode}
              />
            )}
          </SidebarProvider>
        </div>
        <Dialogs />
      </div>
    </DialogManagerProvider>
  )
}

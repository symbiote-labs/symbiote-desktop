import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { SidebarProvider } from '@renderer/ui/sidebar'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StoreContent } from './components/StoreContent'
import { StoreSidebar } from './components/StoreSidebar'
import storeList from './data/store_list.json'

export default function StoreLayout() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all')
  const { t } = useTranslation()

  const filteredItems = storeList.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    let matchesCategory = false
    if (selectedCategory === 'all') {
      matchesCategory = true
    } else if (['featured', 'new', 'top'].includes(selectedCategory)) {
      if (selectedCategory === 'featured') {
        matchesCategory = item.featured === true
      }
    } else {
      matchesCategory = item.categoryId === selectedCategory
    }

    const matchesSubcategory =
      ['all', 'featured', 'new', 'top'].includes(selectedCategory) ||
      selectedSubcategory === 'all' ||
      item.subcategoryId === selectedSubcategory

    return matchesSearch && matchesCategory && matchesSubcategory
  })

  const handleSelectCategory = (categoryId: string, subcategoryId: string) => {
    console.log('categoryId', categoryId)
    console.log('subcategoryId', subcategoryId)
    setSelectedCategory(categoryId)
    setSelectedSubcategory(subcategoryId)
    // setSelectedSubcategory('all')
  }

  // const handleTabCategoryChange = (categoryId: string) => {
  //   setSelectedCategory(categoryId)
  //   setSelectedSubcategory('all')
  // }

  return (
    <div className="h-[calc(100vh_-_var(--navbar-height))] w-full">
      <Navbar className="h-full">
        <NavbarCenter>{t('store.title')}</NavbarCenter>
      </Navbar>
      <div id="content-container" className="h-full w-full">
        <SidebarProvider className="h-full w-full relative min-h-full">
          <StoreSidebar
            selectedCategory={selectedCategory}
            selectedSubcategory={selectedSubcategory}
            onSelectCategory={handleSelectCategory}
          />
          <StoreContent
            viewMode={viewMode}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            items={filteredItems}
            onSearchQueryChange={setSearchQuery}
            onViewModeChange={setViewMode}
          />
        </SidebarProvider>
      </div>
    </div>
  )
}

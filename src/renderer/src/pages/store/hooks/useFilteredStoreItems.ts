import { CherryStoreItem } from '@renderer/types/cherryStore'
import { useMemo } from 'react'

// 假设 Item 类型定义，您可以从 store_list.json 的结构推断或在项目中共享
// 如果没有明确的类型定义，可以使用 any，但强烈建议定义类型

export function useFilteredStoreItems(
  storeList: CherryStoreItem[],
  searchQuery: string,
  selectedCategory: string,
  selectedSubcategory: string
) {
  return useMemo(() => {
    if (!storeList) {
      return []
    }
    return storeList.filter((item) => {
      const lowerSearchQuery = searchQuery.toLowerCase()
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(lowerSearchQuery) ||
        item.description.toLowerCase().includes(lowerSearchQuery) ||
        item.author.toLowerCase().includes(lowerSearchQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(lowerSearchQuery))

      let matchesCategory = false
      if (selectedCategory === 'all') {
        matchesCategory = true
      } else if (['featured', 'new', 'top'].includes(selectedCategory)) {
        // 当前的筛选逻辑中 'featured', 'new', 'top' 是特殊处理的
        // 'new' 和 'top' 还没有具体的实现逻辑，这里保持和原组件一致
        if (selectedCategory === 'featured') {
          matchesCategory = item.featured === true
        } else {
          // 如果 selectedCategory 是 'new' 或 'top' 但不是 'featured'
          // 并且 item 没有 .featured = true, 那么 matchesCategory 仍然是 false
          // 这可能需要根据实际需求调整，例如：
          // if (selectedCategory === 'new') matchesCategory = item.isNew === true; (假设有 isNew 字段)
          // if (selectedCategory === 'top') matchesCategory = item.isTop === true; (假设有 isTop 字段)
          // 为了保持和原逻辑一致，这里暂时不修改这部分行为，但提示您可能需要完善
          matchesCategory = item.featured === true && ['featured'].includes(selectedCategory) // 或者更复杂的逻辑
        }
      } else {
        matchesCategory = item.categoryId === selectedCategory
      }

      const matchesSubcategory =
        ['all', 'featured', 'new', 'top'].includes(selectedCategory) || // If a special category is selected, subcategory filter might be bypassed or handled differently
        selectedSubcategory === 'all' ||
        item.subcategoryId === selectedSubcategory

      return matchesSearch && matchesCategory && matchesSubcategory
    })
  }, [storeList, searchQuery, selectedCategory, selectedSubcategory])
}

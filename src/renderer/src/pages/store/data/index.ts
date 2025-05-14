import store from '@renderer/store'
import { Category, CherryStoreItem } from '@renderer/types/cherryStore'

// 移除 LoadedStoreData 和 LoadedStoreDataByType，因为我们将按需加载
// export interface LoadedStoreData {
//   categories: Category[]
//   allItems: CherryStoreItem[]
// }

// export interface LoadedStoreDataByType {
//   categories: Category[]
//   assistantItems?: CherryStoreItem[]
//   knowledgeItems?: CherryStoreItem[] // Example for another type
//   mcpServerItems?: CherryStoreItem[] // Example for another type
//   // Add other item types here as you create their list_*.json files
// }

const getResourcesPath = (path: string) => {
  const { resourcesPath } = store.getState().runtime
  return resourcesPath + path
}

// 缓存变量
let cachedCategories: Category[] | null = null
const cachedItemsByFile: Record<string, CherryStoreItem[]> = {}

// Helper function to read and parse JSON files safely
async function readFileSafe<T>(filePath: string): Promise<T | undefined> {
  try {
    if (!window.api?.fs?.read) {
      console.error('window.api.fs.read is not available. Ensure preload script is set up correctly.')
      return undefined
    }
    const fileContent = await window.api.fs.read(filePath)
    if (typeof fileContent === 'string') {
      return JSON.parse(fileContent) as T
    }
    console.warn(
      `Content read from ${filePath} was not a string or file might be empty/missing. Received:`,
      fileContent
    )
    return undefined
  } catch (error) {
    console.error(`Error reading or parsing file ${filePath}:`, error)
    return undefined
  }
}

export async function loadCategories(resourcesPath: string): Promise<Category[]> {
  if (cachedCategories) {
    console.log('Returning cached categories:', cachedCategories.length)
    return cachedCategories
  }

  const categoriesFilePath = resourcesPath + '/data/store_categories.json'
  console.log('categoriesFilePath', categoriesFilePath)
  const categories = (await readFileSafe<Category[]>(categoriesFilePath)) || []

  if (categories.length > 0) {
    cachedCategories = categories
    console.log('Categories loaded and cached:', categories.length)
  } else {
    console.log('No categories found or error loading categories.')
  }
  return categories
}

// 新函数：根据分类、子分类和搜索查询加载和筛选商品
export async function loadAndFilterItems(
  categoryId: string,
  subcategoryId: string,
  searchQuery: string
): Promise<CherryStoreItem[]> {
  let itemsFilePath = ''
  if (categoryId === 'all' || !categoryId) {
    console.warn("loadAndFilterItems called with 'all' or invalid categoryId. Returning empty for now.")
    return []
  } else {
    itemsFilePath = getResourcesPath(`/data/store_list_${categoryId}.json`)
  }

  if (!itemsFilePath) {
    console.error(`No item file path determined for categoryId: ${categoryId}`)
    return []
  }

  let items: CherryStoreItem[] = []

  if (cachedItemsByFile[itemsFilePath]) {
    items = cachedItemsByFile[itemsFilePath]
    console.log(`Returning cached items for ${itemsFilePath}:`, items.length)
  } else {
    const loadedItems = await readFileSafe<CherryStoreItem[]>(itemsFilePath)
    if (loadedItems) {
      items = loadedItems
      cachedItemsByFile[itemsFilePath] = loadedItems
      console.log(`Items loaded and cached for ${itemsFilePath}:`, items.length)
    } else {
      console.log(`No items found or error loading items for: ${itemsFilePath}`)
      // 确保在文件读取失败或为空时，items 仍然是空数组
      items = []
      // 也可以选择缓存一个空数组，以避免重复尝试读取不存在或错误的文件
      // cachedItemsByFile[itemsFilePath] = [];
    }
  }

  if (!items.length) {
    // 如果缓存中是空数组或者新加载的是空数组，直接返回，避免不必要的筛选
    return []
  }

  let filteredItems = items

  if (searchQuery || subcategoryId) {
    const query = searchQuery.toLowerCase()
    filteredItems = filteredItems.filter((item) => {
      const searchableText = `${item.subcategoryId} ${item.title.toLowerCase()} ${item.author?.toLowerCase() || ''} ${item.tags?.join(' ')?.toLowerCase() || ''}`
      return searchableText.includes(query)
    })
  }
  console.log(
    `Filtered items for ${categoryId} - ${subcategoryId} - "${searchQuery}". Found: ${filteredItems.length} (from ${items.length} initial)`
  )
  return filteredItems
}

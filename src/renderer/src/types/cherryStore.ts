export interface CherryStoreItem {
  id: string
  title: string
  description: string
  type: string
  categoryId: string
  subcategoryId: string
  author: string
  rating: number
  downloads: string
  image: string
  tags: string[]
  featured?: boolean
}

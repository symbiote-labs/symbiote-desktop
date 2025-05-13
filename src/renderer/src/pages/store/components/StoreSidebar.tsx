import { Badge } from '@renderer/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@renderer/ui/sidebar'

import { Category } from '../data'

interface StoreSidebarProps {
  categories: Category[]
  selectedCategory: string
  selectedSubcategory: string
  onSelectCategory: (categoryId: string, subcategoryId: string) => void
}

export function StoreSidebar({
  categories,
  selectedCategory,
  selectedSubcategory,
  onSelectCategory
}: StoreSidebarProps) {
  if (!categories || categories.length === 0) {
    return (
      <Sidebar className="absolute left-0 top-0 h-full border-r">
        <SidebarContent>
          <p className="p-4 text-sm text-gray-500">No categories loaded.</p>
        </SidebarContent>
      </Sidebar>
    )
  }

  return (
    <Sidebar className="absolute left-0 top-0 h-full border-r">
      <SidebarContent>
        {categories.map((category) => (
          <SidebarGroup key={category.id}>
            {category.id !== 'all' && <SidebarGroupLabel>{category.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {category.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={category.id === selectedCategory && item.id === selectedSubcategory}
                      className="justify-between"
                      onClick={() => {
                        onSelectCategory(category.id, item.id)
                      }}>
                      {item.name}
                      {typeof item.count === 'number' && (
                        <Badge variant="secondary" className="ml-auto">
                          {item.count}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}

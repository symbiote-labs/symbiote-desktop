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

import categories from '../data/store_categories.json'

interface StoreSidebarProps {
  selectedCategory: string
  selectedSubcategory: string
  onSelectCategory: (categoryId: string, subcategoryId: string) => void
}

export function StoreSidebar({ selectedCategory, selectedSubcategory, onSelectCategory }: StoreSidebarProps) {
  console.log('selectedCategory', selectedCategory)
  console.log('selectedSubcategory', selectedSubcategory)
  return (
    <Sidebar className="absolute left-0 top-0 h-full border-r">
      <SidebarContent>
        {categories.map((category) => (
          <SidebarGroup key={category.title}>
            {/* Only render label if it's not the 'all' category wrapper */}
            {category.id !== 'all' && <SidebarGroupLabel>{category.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {category.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={category.id === selectedCategory && item.id === selectedSubcategory}
                      className="justify-between"
                      onClick={() => {
                        console.log('category', category)
                        // Special handling for top-level 'all' categories vs nested ones
                        onSelectCategory(category.id, item.id) // Selecting 'all', 'featured', 'new', 'top' uses the item.id as category
                      }}>
                      {item.name}
                      <Badge variant="secondary" className="ml-auto">
                        {item.count}
                      </Badge>
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

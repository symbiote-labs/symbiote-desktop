import { Category, SubCategoryItem } from '@renderer/types/cherryStore'
import { Badge } from '@renderer/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem
} from '@renderer/ui/sidebar'

interface StoreSidebarProps {
  categories: Category[]
  selectedCategory: string
  selectedSubcategory: string
  onSelectCategory: (categoryId: string, subcategoryId: string, row?: SubCategoryItem) => void
}

export function StoreSidebar({
  categories,
  selectedCategory,
  selectedSubcategory,
  onSelectCategory
}: StoreSidebarProps) {
  if (!categories || categories.length === 0) {
    return (
      <Sidebar className="absolute top-0 left-0 h-full border-r">
        <SidebarContent>
          <p className="p-4 text-sm text-gray-500">No categories loaded.</p>
        </SidebarContent>
      </Sidebar>
    )
  }

  return (
    <Sidebar className="absolute top-0 left-0 h-full border-r">
      <SidebarContent>
        <SidebarMenu className="gap-0">
          {categories.map((category, index) =>
            category.items?.length ? (
              <Collapsible key={category.id} defaultOpen={index === 0} className="group/collapsible w-full">
                <SidebarMenuItem className="w-full px-0 py-0">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      variant="outline"
                      className="rounded-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none">
                      <span className="truncate">{category.title}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden text-sm transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                    <SidebarMenuSub className="py-1 pr-1 pl-4">
                      {category.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.id}>
                          <SidebarMenuButton
                            isActive={category.id === selectedCategory && subItem.id === selectedSubcategory}
                            className="w-full justify-between"
                            onClick={() => {
                              onSelectCategory(category.id, subItem.id, subItem)
                            }}
                            size="sm">
                            <span className="truncate">{subItem.name}</span>
                            {typeof subItem.count === 'number' && (
                              <Badge variant="secondary" className="ml-auto shrink-0">
                                {subItem.count}
                              </Badge>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuSubItem>
                      ))}
                      {/* {category.items.length === 0 && (
                        <SidebarMenuSubItem className="px-3 py-1.5 text-xs text-muted-foreground">
                          No items
                        </SidebarMenuSubItem>
                      )} */}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={category.id}>
                <SidebarMenuButton
                  asChild
                  isActive={category.id === selectedCategory}
                  variant="outline"
                  className="rounded-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none"
                  onClick={() => {
                    onSelectCategory(category.id, '')
                  }}>
                  {/* <item.icon /> */}
                  <span>{category.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}

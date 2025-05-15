import { CherryStoreItem } from '@renderer/types/cherryStore'
import { Button } from '@renderer/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@renderer/ui/dropdown-menu'
import { Input } from '@renderer/ui/input'
import { cn } from '@renderer/utils'
import { Filter, Grid3X3, List, Search } from 'lucide-react'

// Define the type for a store item based on store_list.json
import { GridView } from './GridView'
import { ListView } from './ListView'

interface StoreContentProps {
  viewMode: 'grid' | 'list'
  searchQuery: string
  selectedCategory: string
  items: CherryStoreItem[]
  onSearchQueryChange: (query: string) => void
  onViewModeChange: (mode: 'grid' | 'list') => void
}

export function StoreContent({
  viewMode,
  searchQuery,
  items,
  onSearchQueryChange,
  onViewModeChange
}: StoreContentProps) {
  return (
    <div className="w-full flex-1 overflow-auto">
      {/* Sticky Header for Search, Filter, View Mode, and Category Tabs */}
      <div className="sticky top-0 z-10 border-b bg-background p-4">
        <div className="flex flex-col gap-4">
          {/* Top row: Search, Filter, View buttons */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search store..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Add actual filtering logic later */}
                <DropdownMenuItem>Most Popular</DropdownMenuItem>
                <DropdownMenuItem>Newest</DropdownMenuItem>
                <DropdownMenuItem>Highest Rated</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onViewModeChange('grid')}
              className={cn(viewMode === 'grid' && 'bg-accent text-accent-foreground')}>
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onViewModeChange('list')}
              className={cn(viewMode === 'list' && 'bg-accent text-accent-foreground')}>
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Bottom row: Category Tabs */}
          {/* <Tabs value={selectedCategory} onValueChange={onCategoryChange}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="mcp">MCP Services</TabsTrigger>
              <TabsTrigger value="plugins">Plugins</TabsTrigger>
              <TabsTrigger value="apps">Applications</TabsTrigger>
            </TabsList>
          </Tabs> */}
        </div>
      </div>

      {/* Main Content Area: Grid or List View */}
      <div className="w-full p-4">
        {items.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center">
            <p className="text-center text-muted-foreground">No items found matching your criteria.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <GridView items={items} />
        ) : (
          <ListView items={items} />
        )}
      </div>
    </div>
  )
}

// List View Component

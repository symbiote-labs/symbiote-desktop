import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@renderer/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@renderer/ui/dropdown-menu'
import { Input } from '@renderer/ui/input'
import { BlurFade } from '@renderer/ui/third-party/BlurFade'
import { cn } from '@renderer/utils'
import { Download, Filter, Grid3X3, List, Search, Star } from 'lucide-react'
// Define the type for a store item based on store_list.json
interface StoreItem {
  id: number
  title: string
  description: string
  type: string
  categoryId: string
  subcategoryId: string
  author: string
  rating: number
  downloads: string
  image?: string
  tags: string[]
  featured: boolean
}

interface StoreContentProps {
  viewMode: 'grid' | 'list'
  searchQuery: string
  selectedCategory: string
  items: StoreItem[]
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
    <div className="flex-1 overflow-auto">
      {/* Sticky Header for Search, Filter, View Mode, and Category Tabs */}
      <div className="sticky top-0 z-10 border-b bg-background p-4">
        <div className="flex flex-col gap-4">
          {/* Top row: Search, Filter, View buttons */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
      <div className="p-4">
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

// Grid View Component
function GridView({ items }: { items: StoreItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item, idx) => (
        <BlurFade key={item.id} delay={0.25 + idx * 0.05} inView>
          <Card key={item.id} className="overflow-hidden p-0">
            <CardHeader className="p-0">
              <div className="aspect-square w-full overflow-hidden bg-muted">
                <img
                  src={item.image || '/placeholder.svg'} // Use placeholder if image missing
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="line-clamp-1 text-base">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.author}</p>
                </div>
                <Badge variant="outline">{item.type}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
            <CardFooter className="flex items-center justify-between p-4 pt-0">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="text-sm">{item.rating}</span>
              </div>
              <Button size="sm">
                <Download className="mr-2 h-3.5 w-3.5 text-white dark:text-black" />
                Install
              </Button>
            </CardFooter>
          </Card>
        </BlurFade>
      ))}
    </div>
  )
}

// List View Component
function ListView({ items }: { items: StoreItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id} className="p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-l-lg bg-muted sm:h-auto">
              <img
                src={item.image || '/placeholder.svg'} // Use placeholder if image missing
                alt={item.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.author}</p>
                  </div>
                  <Badge variant="outline">{item.type}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t p-4 sm:w-48 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:p-4">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="text-sm">{item.rating}</span>
                <span className="text-xs text-muted-foreground">({item.downloads})</span>
              </div>
              <Button size="sm" className="mt-2">
                <Download className="mr-2 h-3.5 w-3.5 text-white dark:text-black" />
                Install
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

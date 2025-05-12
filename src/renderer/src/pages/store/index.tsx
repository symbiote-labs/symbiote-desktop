import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@renderer/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@renderer/ui/dropdown-menu'
import { Input } from '@renderer/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from '@renderer/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@renderer/ui/tabs'
import { cn } from '@renderer/utils'
import { Download, Filter, Grid3X3, List, Search, Star } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import categories from '../../../../../resources/data/store_categories.json'
import storeList from '../../../../../resources/data/store_list.json'

// const categories = [
//   {
//     id: 'all',
//     title: 'Categories',
//     items: [
//       { id: 'all', name: 'All', count: 120, isActive: true },
//       { id: 'featured', name: 'Featured', count: 24 },
//       { id: 'new', name: 'New Releases', count: 18 },
//       { id: 'top', name: 'Top Rated', count: 32 }
//     ]
//   },
//   {
//     id: 'mcp',
//     title: 'MCP Services',
//     items: [
//       { id: 'mcp-text', name: 'Text Generation', count: 15 },
//       { id: 'mcp-image', name: 'Image Generation', count: 8 },
//       { id: 'mcp-audio', name: 'Audio Processing', count: 6 },
//       { id: 'mcp-code', name: 'Code Assistance', count: 12 }
//     ]
//   },
//   {
//     id: 'plugins',
//     title: 'Plugins',
//     items: [
//       { id: 'plugin-productivity', name: 'Productivity', count: 14 },
//       { id: 'plugin-development', name: 'Development', count: 22 },
//       { id: 'plugin-design', name: 'Design', count: 9 },
//       { id: 'plugin-utilities', name: 'Utilities', count: 18 }
//     ]
//   },
//   {
//     id: 'apps',
//     title: 'Applications',
//     items: [
//       { id: 'app-desktop', name: 'Desktop', count: 7 },
//       { id: 'app-web', name: 'Web', count: 11 },
//       { id: 'app-mobile', name: 'Mobile', count: 5 },
//       { id: 'app-cli', name: 'CLI', count: 8 }
//     ]
//   }
// ]

export default function StoreLayout() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all')
  const { t } = useTranslation()
  // Update the filteredItems logic to use the new category IDs
  const filteredItems = storeList.filter((item) => {
    // First apply search filter
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    // Then apply category filters
    const matchesCategory =
      selectedCategory === 'all' ||
      item.categoryId === selectedCategory ||
      (selectedCategory === 'featured' && item.featured)

    const matchesSubcategory = selectedSubcategory === 'all' || item.subcategoryId === selectedSubcategory

    return matchesSearch && matchesCategory && matchesSubcategory
  })

  return (
    <div className="h-[calc(100vh_-_var(--navbar-height))] w-full">
      <Navbar className="h-full">
        <NavbarCenter>{t('store.title')}</NavbarCenter>
      </Navbar>
      <div id="content-container" className="h-full w-full">
        <SidebarProvider className="h-full w-full relative min-h-full">
          <Sidebar className="absolute left-0 top-0 h-full border-r">
            <SidebarHeader className="border-b px-4 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Cherry Store</h2>
              </div>
            </SidebarHeader>
            <SidebarContent>
              {categories.map((category) => (
                <SidebarGroup key={category.title}>
                  <SidebarGroupLabel>{category.title}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {category.items.map((item) => (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={category.id === selectedCategory && item.id === selectedSubcategory}
                            className="justify-between"
                            onClick={() => {
                              setSelectedCategory(category.id)
                              setSelectedSubcategory(item.id)
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

          <div className="flex-1 overflow-auto">
            <div className="sticky top-0 z-10 border-b bg-background p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search store..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Most Popular</DropdownMenuItem>
                      <DropdownMenuItem>Newest</DropdownMenuItem>
                      <DropdownMenuItem>Highest Rated</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    className={cn(viewMode === 'grid' && 'bg-accent text-accent-foreground')}>
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setViewMode('list')}
                    className={cn(viewMode === 'list' && 'bg-accent text-accent-foreground')}>
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                <Tabs
                  defaultValue="all"
                  value={selectedCategory}
                  onValueChange={(value) => {
                    setSelectedCategory(value)
                    setSelectedSubcategory('all')
                  }}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="mcp">MCP Services</TabsTrigger>
                    <TabsTrigger value="plugins">Plugins</TabsTrigger>
                    <TabsTrigger value="apps">Applications</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div className="p-4">
              {filteredItems.length === 0 ? (
                <div className="flex h-[400px] items-center justify-center">
                  <p className="text-center text-muted-foreground">No items found matching your search.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filteredItems.map((item) => (
                    <Card key={item.id} className="overflow-hidden p-0">
                      <CardHeader className="p-0">
                        <div className="aspect-square w-full overflow-hidden bg-muted">
                          <img
                            src={item.image || '/placeholder.svg'}
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
                          <Download className="mr-2 h-3.5 w-3.5 text-white! dark:text-black!" />
                          Install
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <Card key={item.id} className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-l-lg bg-muted sm:h-auto">
                          <img
                            src={item.image || '/placeholder.svg'}
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
                            <Download className="mr-2 h-3.5 w-3.5 text-white! dark:text-black!" />
                            Install
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SidebarProvider>
      </div>
    </div>
  )
}

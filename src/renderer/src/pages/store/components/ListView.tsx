import { CherryStoreItem } from '@renderer/types/cherryStore'
import { Badge } from '@renderer/ui/badge'
import { Card } from '@renderer/ui/card'
import { useState } from 'react'

import { ItemDetailDialog } from './ItemDetailDialog'

export function ListView({ items }: { items: CherryStoreItem[] }) {
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<CherryStoreItem | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  const handleCardClick = (item: CherryStoreItem) => {
    setSelectedItemForDetail(item)
    setIsDetailDialogOpen(true)
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className="p-0 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleCardClick(item)}>
            <div className="flex flex-col sm:flex-row">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-l-lg bg-muted sm:h-auto flex items-center justify-center">
                {item.icon ? (
                  <div
                    className="flex h-full w-full items-center justify-center text-3xl"
                    role="img"
                    aria-label={item.title}>
                    {item.icon}
                  </div>
                ) : (
                  <img
                    src={item.image || '/placeholder.svg'} // Use placeholder if image missing
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                )}
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
              {/* <div className="flex items-center justify-between border-t p-4 sm:w-48 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:p-4"> */}
              {/* <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  <span className="text-sm">{item?.rating}</span>
                  <span className="text-xs text-muted-foreground">({item?.downloads})</span>
                </div> */}
              {/* <Button size="sm" className="mt-2">
                  <Download className="mr-2 h-3.5 w-3.5 text-white! dark:text-black!" />
                  Install
                </Button>
              </div> */}
            </div>
          </Card>
        ))}
      </div>
      <ItemDetailDialog
        item={selectedItemForDetail}
        isOpen={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
      />
    </>
  )
}

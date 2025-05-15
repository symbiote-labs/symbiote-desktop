import { CherryStoreItem } from '@renderer/types/cherryStore'
import { Badge } from '@renderer/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/ui/card'
import { BlurFade } from '@renderer/ui/third-party/BlurFade'
import { cn } from '@renderer/utils'
import { useState } from 'react'

import { ItemDetailDialog } from './ItemDetailDialog'

export function GridView({ items }: { items: CherryStoreItem[] }) {
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<CherryStoreItem | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)

  const handleCardClick = (item: CherryStoreItem) => {
    setSelectedItemForDetail(item)
    setIsDetailDialogOpen(true)
  }

  return (
    <>
      <div className="columns-4 gap-4">
        {items.map((item) => (
          <BlurFade key={item.id} delay={0.2} inView className="mb-4 cursor-pointer">
            <Card
              className="overflow-hidden transition-transform hover:scale-105"
              onClick={() => handleCardClick(item)}>
              <CardHeader className="p-0">
                {item.icon ? (
                  <div
                    className="flex h-full w-full items-center justify-center text-4xl"
                    role="img"
                    aria-label={item.title}>
                    {item.icon}
                  </div>
                ) : (
                  <div className={cn('w-full overflow-hidden bg-muted', 'aspect-square')}>
                    <img
                      src={item.image || '/placeholder.svg'}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent className={cn('px-4', 'min-h-[120px]', 'space-y-1')}>
                <CardTitle className="line-clamp-2 text-base">{item.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.author}</p>
                <div className="space-x-2">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className={cn('mt-2 text-sm text-muted-foreground', 'line-clamp-4 xl:line-clamp-7')}>
                  {item.description}
                </p>
              </CardContent>
            </Card>
          </BlurFade>
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

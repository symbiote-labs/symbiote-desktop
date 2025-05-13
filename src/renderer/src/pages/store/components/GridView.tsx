import { CherryStoreItem } from '@renderer/types/cherryStore'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@renderer/ui/card'
import { BlurFade } from '@renderer/ui/third-party/BlurFade'
import { Download, Star } from 'lucide-react'

export function GridView({ items }: { items: CherryStoreItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-4 ">
      {items.map((item) => (
        <BlurFade key={item.id} delay={0.25} inView className="overflow-hidden flex flex-col">
          <Card className="overflow-hidden p-0 flex flex-col">
            <CardHeader className="p-0">
              <div className="aspect-square w-full overflow-hidden bg-muted">
                <img
                  src={item.image || '/placeholder.svg'} // Use placeholder if image missing
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform hover:scale-105"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 flex-grow">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="line-clamp-1 text-base">{item.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.author}</p>
                </div>
                <Badge variant="outline">{item.type}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
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

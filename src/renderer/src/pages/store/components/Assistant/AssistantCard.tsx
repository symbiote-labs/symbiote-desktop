import { AssistantItem } from '@renderer/types/cherryStore'
import { Badge } from '@renderer/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/ui/card'
import { BlurFade } from '@renderer/ui/third-party/BlurFade'
import { cn } from '@renderer/utils'

import { useDialogManager } from '../dialog/DialogManagerContext'

export default function AssistantCard({ item }: { item: AssistantItem }) {
  const { openDialog } = useDialogManager()

  const handleCardClick = () => {
    openDialog('install', item)
  }

  return (
    <BlurFade key={item.id} delay={0.2} inView className="mb-4 cursor-pointer">
      <Card className="overflow-hidden transition-transform hover:scale-105" onClick={handleCardClick}>
        <CardHeader className="p-0">
          <div className="flex h-full w-full items-center justify-center text-4xl" role="img" aria-label={item.title}>
            {item.icon}
          </div>
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
          <p className={cn('mt-2 text-sm text-muted-foreground', 'line-clamp-4 xl:line-clamp-7')}>{item.description}</p>
        </CardContent>
      </Card>
    </BlurFade>
  )
}

import { createAssistantFromAgent } from '@renderer/services/AssistantService'
import { Agent } from '@renderer/types'
import { CherryStoreItem, CherryStoreType } from '@renderer/types/cherryStore'
import { Badge } from '@renderer/ui/badge'
import { Button } from '@renderer/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@renderer/ui/dialog'
import { Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { v4 as uuid } from 'uuid'

export function ItemDetailDialog({
  item,
  isOpen,
  onClose
}: {
  item: CherryStoreItem | null
  isOpen: boolean
  onClose: () => void
}) {
  if (!item) return null

  const handleInstall = () => {
    switch (item.type) {
      case CherryStoreType.ASSISTANT: {
        const getAgentFromSystemAgent = (agent) => {
          return {
            prompt: agent.prompt,
            description: agent.description,
            emoji: agent.icon,
            name: agent.title,
            id: uuid(),
            topics: [],
            type: 'agent'
          }
        }

        createAssistantFromAgent(getAgentFromSystemAgent(item) as unknown as Agent)
        break
      }

      default:
        break
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] sm:max-w-4xl overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div>
            <DialogTitle className="flex items-center text-xl space-x-1">
              {item.title}
              <Badge variant="outline" className="ml-2">
                {item.type}
              </Badge>
              {item.icon && <span className="text-2xl">{item.icon}</span>}
            </DialogTitle>
            <DialogDescription className="mt-1 text-base">{item.description}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm mt-4">
              <ReactMarkdown>{item.prompt}</ReactMarkdown>
            </div>

            {/* {item.requirements && (
              <div className="mt-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
                <h3 className="mb-4 text-lg font-semibold">功能要求</h3>
                <ul className="space-y-2">
                  {item.requirements.map((req: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <Check className="mr-2 mt-0.5 h-4 w-4 text-green-500" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )} */}
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden">
              {item.image && (
                <div className="aspect-square w-full rounded-lg border overflow-hidden bg-muted">
                  <img src={item.image || '/placeholder.svg'} alt={item.title} className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
              {/* <div className="flex items-center justify-between">
                <span className="text-sm font-medium">评分</span>
                <div className="flex items-center">
                  <Star className="mr-1 h-4 w-4 fill-primary text-primary" />
                  <span className="font-medium">{item.rating}</span>
                  <span className="ml-1 text-xs text-muted-foreground">({item.downloads})</span>
                </div>
              </div> */}

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium">版本</span>
                {/* <span>{item.version}</span> */}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium">更新日期</span>
                {/* <span>{item.lastUpdated}</span> */}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium">开发者</span>
                <span>{item.author}</span>
              </div>

              {/* {item.type !== CherryStoreType.ASSISTANT && ( */}
              <div className="mt-4">
                <Button className="w-full" onClick={handleInstall}>
                  <Download className="mr-2 h-4 w-4 text-white! dark:text-black!" />
                  添加到助手
                </Button>
              </div>
              {/* )} */}
            </div>

            <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm space-y-2">
              <h3 className="mb-2 text-sm font-medium">标签</h3>
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h3 className="mb-2 text-sm font-medium">分类</h3>
              <Badge variant="secondary" className="text-xs">
                {item.type}
              </Badge>
            </div>
          </div>
        </div>

        {/* <DialogFooter className="mt-6 flex sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4 text-white! dark:text-black!" />
            添加到助手
          </Button>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  )
}

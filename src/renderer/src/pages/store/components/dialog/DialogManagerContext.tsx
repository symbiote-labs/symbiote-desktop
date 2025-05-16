import { CherryStoreItem } from '@renderer/types/cherryStore'
import { createContext, ReactNode, use, useState } from 'react'

interface ActiveDialog {
  type: string
  item: CherryStoreItem
}

interface DialogManagerContextType {
  activeDialog: ActiveDialog | null
  openDialog: (type: string, item: CherryStoreItem) => void
  closeDialog: () => void
}

const DialogManagerContext = createContext<DialogManagerContextType | undefined>(undefined)

export const DialogManagerProvider = ({ children }: { children: ReactNode }) => {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null)

  const openDialog = (type: string, item: CherryStoreItem) => {
    setActiveDialog({ type, item })
  }

  const closeDialog = () => {
    setActiveDialog(null)
  }

  return <DialogManagerContext value={{ activeDialog, openDialog, closeDialog }}>{children}</DialogManagerContext>
}

export const useDialogManager = (): DialogManagerContextType => {
  const context = use(DialogManagerContext)
  if (!context) {
    // More robust check
    throw new Error('useDialogManager must be used within a DialogManagerProvider')
  }
  return context
}

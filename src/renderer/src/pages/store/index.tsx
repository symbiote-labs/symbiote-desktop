import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { Button } from '@renderer/ui/button'
import { Toaster } from '@renderer/ui/sonner'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function Store() {
  const { t } = useTranslation()
  return (
    <div className="h-[calc(100vh_-_var(--navbar-height))] w-full">
      <Navbar className="h-full">
        <NavbarCenter>{t('store.title')}</NavbarCenter>
      </Navbar>
      <div id="content-container" className="h-full w-full">
        <Button
          variant="outline"
          onClick={() =>
            toast('配置成功', {
              description: '当你能看到这个toast,说明配置成功'
            })
          }>
          tailwindcss & shadcn/ui 配置成功了么
        </Button>
      </div>
      <Toaster />
    </div>
  )
}

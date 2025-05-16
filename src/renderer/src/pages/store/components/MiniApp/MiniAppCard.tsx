import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { MiniAppItem } from '@renderer/types/cherryStore'
import { BlurFade } from '@renderer/ui/third-party/BlurFade'

import logoList from './logoList'
export default function MiniAppCard({ item }: { item: MiniAppItem }) {
  const { openMinappKeepAlive } = useMinappPopup()
  const handleClick = () => {
    openMinappKeepAlive({
      id: item.id,
      name: item.title,
      url: item.url,
      logo: item.image,
      style: item.style
    })
  }
  return (
    <BlurFade key={item.id} delay={0.2} inView className="mb-4 cursor-pointer">
      <div className="flex h-full w-full flex-col items-center justify-between" onClick={handleClick}>
        <img src={logoList[item.image]} alt={item.title} className="w-full rounded-2xl" style={item.style} />
        <div className="mt-2 flex flex-col items-center justify-center">
          <p className="text-base text-[clamp(12px,1.1vw,16px)] font-medium text-muted-foreground">{item.title}</p>
        </div>
      </div>
    </BlurFade>
  )
}

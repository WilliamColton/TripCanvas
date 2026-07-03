import { useEffect, useState } from 'react'
import { getCachedTemplatePreviewUrl, getTemplatePreviewImageUrl, resolveTemplatePreviewUrl } from '../lib/backendApi'

interface Props {
  id: string
  className?: string
  alt?: string
}

/**
 * 模板预览图：优先用已缓存的 COS 直链（内存/localStorage），未命中时回退固定 302 路径并异步解析后替换。
 * 避免每次刷新都走 302 重新生成预签名。
 */
export default function TemplatePreviewImg({ id, className, alt = '' }: Props) {
  const [url, setUrl] = useState<string>(() => getCachedTemplatePreviewUrl(id) ?? getTemplatePreviewImageUrl(id))
  useEffect(() => {
    const cached = getCachedTemplatePreviewUrl(id)
    if (cached) {
      setUrl(cached)
      return
    }
    let cancelled = false
    resolveTemplatePreviewUrl(id)
      .then((u) => { if (!cancelled && u) setUrl(u) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  return <img src={url} alt={alt} className={className} />
}

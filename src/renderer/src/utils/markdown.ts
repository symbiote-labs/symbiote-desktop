// 更彻底的查找方法，递归搜索所有子元素
export const findCitationInChildren = (children) => {
  if (!children) return null

  // 直接搜索子元素
  for (const child of Array.isArray(children) ? children : [children]) {
    if (typeof child === 'object' && child?.props?.['data-citation']) {
      return child.props['data-citation']
    }

    // 递归查找更深层次
    if (typeof child === 'object' && child?.props?.children) {
      const found = findCitationInChildren(child.props.children)
      if (found) return found
    }
  }

  return null
}

export const MARKDOWN_ALLOWED_TAGS = [
  'style',
  'p',
  'div',
  'span',
  'b',
  'i',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'table',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
  'br',
  'hr',
  'svg',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'text',
  'g',
  'defs',
  'title',
  'desc',
  'tspan',
  'sub',
  'sup',
  'think',
  'translated', // 添加自定义翻译标签
  'tool-block' // 添加自定义工具块标签
]

// rehype-sanitize配置
export const sanitizeSchema = {
  tagNames: [...MARKDOWN_ALLOWED_TAGS, 'tool-block'], // 确保 tool-block 在允许的标签中
  attributes: {
    '*': ['className', 'style', 'id', 'title', 'data-*'],
    'tool-block': ['id'], // 允许 tool-block 标签使用 id 属性
    svg: ['viewBox', 'width', 'height', 'xmlns', 'fill', 'stroke'],
    path: ['d', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
    rect: ['x', 'y', 'width', 'height', 'fill', 'stroke'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke'],
    polyline: ['points', 'fill', 'stroke'],
    polygon: ['points', 'fill', 'stroke'],
    text: ['x', 'y', 'fill', 'textAnchor', 'dominantBaseline'],
    g: ['transform', 'fill', 'stroke'],
    a: ['href', 'target', 'rel'],
    sup: ['class', 'data-citation', 'onclick'], // 允许sup标签使用onclick和data-citation属性
    translated: ['original', 'language', 'onclick'] // 添加翻译标签的属性
  }
}

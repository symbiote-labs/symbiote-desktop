# Edge风格标签页实现指南

## 概述

本文档记录了在实现Microsoft Edge风格标签页过程中的经验和教训，包括样式、交互和动画效果的实现细节。

## 关键特性

Edge浏览器的标签页具有以下关键特性：

1. **视觉设计**
   - 圆角设计（顶部圆角，底部直角）
   - 活动标签页有底部边框高亮
   - 悬停效果（背景色变化）
   - 紧凑的布局

2. **交互效果**
   - 拖拽重排序
   - 拖拽时的视觉反馈（阴影、缩放）
   - 标签页推挤效果

3. **动画效果**
   - 标签页切换动画
   - 新增/关闭标签页动画
   - 拖拽过程中的平滑过渡

## 实现方案

### 1. 组件结构

```
- AnimatedBrowserTabs (主容器)
  - TabsContext (上下文提供者)
  - TabItem (单个标签页)
  - TabHoverIndicator (悬停指示器)
  - TabActiveIndicator (活动指示器)
  - DragPlaceholder (拖拽占位符)
  - AddTabButton (添加按钮)
```

### 2. 样式实现

使用styled-components实现Edge风格的标签页样式：

```typescript
// 单个标签页
export const TabItem = styled(motion.div)<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  margin: 0 1px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  position: relative;
  background-color: ${({ $isActive }) => 
    $isActive ? 'var(--color-bg-2)' : 'transparent'};
  color: ${({ $isActive }) => 
    $isActive ? 'var(--color-text-1)' : 'var(--color-text-2)'};
  font-weight: ${({ $isActive }) => ($isActive ? '500' : 'normal')};
  transition: all 0.2s ease;
  min-width: 120px;
  max-width: 240px;
  flex-shrink: 0;
  border-bottom: ${({ $isActive }) => 
    $isActive ? '2px solid var(--color-primary)' : 'none'};
  
  &:hover {
    background-color: ${({ $isActive }) => 
      $isActive ? 'var(--color-bg-2)' : 'var(--color-bg-3)'};
  }
  
  &.dragging {
    opacity: 0.7;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: scale(1.02);
  }
`
```

### 3. 拖拽功能实现

使用原生HTML5拖拽API结合framer-motion实现拖拽功能：

```typescript
// 处理拖拽开始
const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
  e.dataTransfer.setData('text/plain', tab.id)
  e.dataTransfer.effectAllowed = 'move'
  
  // 设置拖拽图像为透明
  const img = new Image()
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  e.dataTransfer.setDragImage(img, 0, 0)
  
  setDraggedTabId(tab.id)
  setIsDragging(true)
  onDragStart(index)
  
  // 添加拖拽样式
  if (tabRef.current) {
    tabRef.current.classList.add('dragging')
  }
}
```

### 4. 动画效果实现

使用framer-motion实现平滑的动画效果：

```typescript
<StyledTabItem
  ref={tabRef}
  $isActive={isActive}
  onClick={() => onTabChange(tab.id)}
  onMouseEnter={() => setHoveredTabId(tab.id)}
  onMouseLeave={() => setHoveredTabId(null)}
  draggable
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
  layout
  transition={{
    type: 'spring',
    stiffness: 500,
    damping: 30
  }}
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}
>
  {/* 标签页内容 */}
</StyledTabItem>
```

## 遇到的问题和解决方案

### 1. 标签页标题不更新

详见[标签页标题更新问题](./TabTitleUpdateIssue.md)。

### 2. 拖拽位置计算问题

**问题**：拖拽标签页时，占位符位置计算不准确，导致视觉效果不佳。

**解决方案**：使用getBoundingClientRect()获取精确的元素位置，并考虑容器的滚动位置：

```typescript
// 更新拖拽占位符
useEffect(() => {
  if (draggedTabId && dragOverTabIndex !== null && tabsContainerRef.current) {
    const containerRect = tabsContainerRef.current.getBoundingClientRect()
    const draggedTabElement = tabRefs.current[draggedTabId]
    
    if (draggedTabElement) {
      const draggedTabRect = draggedTabElement.getBoundingClientRect()
      const targetTabElement = tabRefs.current[tabs[dragOverTabIndex].id]
      
      if (targetTabElement) {
        const targetTabRect = targetTabElement.getBoundingClientRect()
        
        setDragPlaceholder({
          x: targetTabRect.left - containerRect.left,
          width: draggedTabRect.width,
          opacity: 0.5
        })
      }
    }
  } else {
    setDragPlaceholder(prev => ({ ...prev, opacity: 0 }))
  }
}, [draggedTabId, dragOverTabIndex, tabs, tabRefs, tabsContainerRef])
```

### 3. 标签页推挤效果

**问题**：实现类似Edge的标签页推挤效果（拖拽时其他标签页会移动让出空间）。

**解决方案**：使用framer-motion的layout属性和spring动画：

```typescript
<TabItem
  key={tab.id}
  layout // 启用自动布局动画
  transition={{
    type: 'spring',
    stiffness: 500,
    damping: 30
  }}
  // 其他属性...
/>
```

### 4. 标签页溢出处理

**问题**：当标签页数量过多时，需要处理溢出情况。

**解决方案**：使用水平滚动和隐藏滚动条：

```typescript
export const TabsListContainer = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  height: 40px;
  padding: 0 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  
  &::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }
`
```

## 最佳实践

1. **性能优化**
   - 使用React.memo包装TabItem组件，避免不必要的重渲染
   - 使用useCallback和useMemo优化回调函数和计算值
   - 使用CSS transitions代替JavaScript动画，提高性能

2. **可访问性**
   - 添加适当的aria属性，如aria-selected和role="tab"
   - 确保可以通过键盘操作标签页（Tab键导航，Enter键激活）
   - 提供足够的颜色对比度

3. **代码组织**
   - 使用Context API管理标签页状态和共享数据
   - 将样式、逻辑和UI组件分离
   - 使用自定义Hook封装复杂逻辑

## 参考资源

1. [Microsoft Edge UI设计指南](https://docs.microsoft.com/en-us/microsoft-edge/design/)
2. [Framer Motion文档](https://www.framer.com/motion/)
3. [HTML5拖放API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
4. [Styled Components文档](https://styled-components.com/docs)

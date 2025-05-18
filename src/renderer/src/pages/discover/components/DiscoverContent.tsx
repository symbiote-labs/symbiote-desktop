import { Category } from '@renderer/types/cherryStore'
import React from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

// 实际的 AgentsPage 组件 - 请确保路径正确
import AgentsPage from '../../agents/AgentsPage'
import AppsPage from '../../apps/AppsPage'
// import AssistantDetailsPage from '../../agents/AssistantDetailsPage'; // 示例详情页

// 其他分类的页面组件 (如果需要)
// const MiniAppPagePlaceholder = ({ categoryId, subcategoryId }: { categoryId?: string; subcategoryId?: string }) => (
//   <div className="p-4">
//     MiniApp Placeholder for Category: {categoryId || 'N/A'}, Subcategory: {subcategoryId || 'N/A'}
//   </div>
// )

export interface DiscoverContentProps {
  activeTabId: string // This should be one of the CherryStoreType values, e.g., "Assistant"
  // selectedSubcategoryId: string
  currentCategory: Category | undefined
}

const DiscoverContent: React.FC<DiscoverContentProps> = ({ activeTabId, currentCategory }) => {
  const location = useLocation() // To see the current path for debugging or more complex logic

  if (!currentCategory || !activeTabId) {
    return <div className="p-4 text-center">Loading: Category or Tab ID missing...</div>
  }

  if (!activeTabId && !location.pathname.startsWith('/discover/')) {
    return <Navigate to="/discover/assistant?subcategory=all" replace /> // Fallback redirect, adjust as needed
  }

  return (
    <Routes>
      {/* Path for Assistant category */}
      <Route path="assistant" element={<AgentsPage />} />
      {/* Path for Mini-App category */}
      <Route path="mini-app" element={<AppsPage />} />

      <Route path="*" element={<div>Discover Feature Not Found at {location.pathname}</div>} />
    </Routes>
  )
}

export default DiscoverContent

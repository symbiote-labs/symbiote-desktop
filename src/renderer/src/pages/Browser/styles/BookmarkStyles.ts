import styled from 'styled-components'

// 书签管理器样式
export const BookmarkManagerContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

export const BookmarkManagerHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
`

export const BookmarkManagerContent = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`

export const BookmarkManagerSidebar = styled.div`
  width: 250px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 16px;
`

export const BookmarkManagerMain = styled.div`
  flex: 1;
  padding: 16px;
  overflow-y: auto;
`

// 书签栏样式
export const BookmarkBarContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background-color: var(--color-bg-1);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  white-space: nowrap;
  height: 32px;

  &::-webkit-scrollbar {
    height: 0;
    display: none;
  }
`

export const BookmarkItem = styled.div<{ isActive?: boolean }>`
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 24px;
  border-radius: 4px;
  margin-right: 4px;
  cursor: pointer;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--color-text-1);
  background-color: ${(props) => (props.isActive ? 'var(--color-bg-2)' : 'transparent')};

  &:hover {
    background-color: var(--color-bg-2);
  }

  .anticon {
    margin-right: 4px;
    font-size: 14px;
  }

  img.favicon {
    width: 16px;
    height: 16px;
    margin-right: 4px;
    object-fit: contain;
  }
`

export const BookmarkFolderItem = styled(BookmarkItem)`
  color: var(--color-text-1);
  font-weight: 500;
`

export const MoreButton = styled.button`
  margin-left: auto;
  padding: 0 8px;
  height: 24px;
  font-size: 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-2);

  &:hover {
    color: var(--color-text-1);
  }
`

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BookContentState {
  // 保存编辑器内容的 map，key 是系统 ID
  contentMap: Record<string, string>;
  
  // 当前系统的编辑器内容
  currentContent: string;
  
  // 当前系统 ID
  currentSystemId: string | null;
  
  // Actions
  saveContent: (systemId: string, content: string) => void;
  loadContent: (systemId: string) => string | null;
  setCurrentSystemId: (systemId: string | null) => void;
  clearContent: (systemId: string) => void;
  hasContent: (systemId: string) => boolean;
}

// 创建 store
export const useBookContentStore = create<BookContentState>()(
  persist(
    (set, get) => ({
      contentMap: {},
      currentContent: '',
      currentSystemId: null,
      
      saveContent: (systemId: string, content: string) => {
        set((state) => {
          const newContentMap = { ...state.contentMap, [systemId]: content };
          return {
            contentMap: newContentMap,
            currentContent: state.currentSystemId === systemId ? content : state.currentContent,
          };
        });
      },
      
      loadContent: (systemId: string) => {
        const { contentMap } = get();
        return contentMap[systemId] || null;
      },
      
      setCurrentSystemId: (systemId: string | null) => {
        const { contentMap } = get();
        set({
          currentSystemId: systemId,
          currentContent: systemId ? contentMap[systemId] || '' : '',
        });
      },
      
      clearContent: (systemId: string) => {
        set((state) => {
          const newContentMap = { ...state.contentMap };
          delete newContentMap[systemId];
          return {
            contentMap: newContentMap,
            currentContent: state.currentSystemId === systemId ? '' : state.currentContent,
          };
        });
      },
      
      hasContent: (systemId: string) => {
        const { contentMap } = get();
        return !!contentMap[systemId];
      },
    }),
    {
      name: 'book-content-storage', // localStorage 的键名
      partialize: (state) => ({ contentMap: state.contentMap }), // 只持久化 contentMap
    }
  )
); 
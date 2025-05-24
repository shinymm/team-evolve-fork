import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Define a specific localStorage key prefix for individual system data
const SYSTEM_DATA_LOCAL_STORAGE_PREFIX = 'req_analysis_system_'

// Helper to generate localStorage key for a system
const getSystemLocalStorageKey = (systemId: string) => `${SYSTEM_DATA_LOCAL_STORAGE_PREFIX}${systemId}`

// Helper to load a single system's state from localStorage
const loadSystemFromLocalStorage = (systemId: string): SystemRequirementState | null => {
  if (typeof window === 'undefined') return null
  try {
    const item = localStorage.getItem(getSystemLocalStorageKey(systemId))
    if (item) {
      const parsed = JSON.parse(item);
      // Ensure all keys from SystemRequirementState are present, fill with defaults if not
      // This helps migrate older localStorage formats or handle partial saves.
      const empty = createEmptySystemState();
      const validatedState: SystemRequirementState = { ...empty };
      for (const key in empty) {
        if (parsed.hasOwnProperty(key)) {
          (validatedState as any)[key] = parsed[key];
        } 
      }
      return validatedState;
    }    
    return null
  } catch (error) {
    console.error(`Error loading system ${systemId} from localStorage:`, error)
    return null
  }
}

// Helper to save a single system's state to localStorage
const saveSystemToLocalStorage = (systemId: string, data: SystemRequirementState) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getSystemLocalStorageKey(systemId), JSON.stringify(data))
  } catch (error) {
    console.error(`Error saving system ${systemId} to localStorage:`, error)
  }
}

// Helper to remove a single system's state from localStorage
const removeSystemFromLocalStorage = (systemId: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getSystemLocalStorageKey(systemId));
  } catch (error) {
    console.error(`Error removing system ${systemId} from localStorage:`, error);
  }
}

// 单个系统的需求分析状态
interface SystemRequirementState {
  // 需求输入
  requirement: string
  
  // 固定的分析结果
  pinnedAnalysis: string | null
  
  // 需求书内容
  requirementBook: string | null
  
  // 固定的需求书内容
  pinnedRequirementBook: string | null
  
  // 是否已固定分析结果
  isPinned: boolean
  
  // 是否已固定需求书
  isRequirementBookPinned: boolean

  // 新增：图片生成的需求初稿
  imageDraft: string | null
}

// Renamed from RequirementAnalysisState to better reflect its new role
interface ActiveSystemContextState extends SystemRequirementState { // Inherits all fields from SystemRequirementState
  currentSystemId: string | null
  isLoading: boolean
  error: string | null
  
  setCurrentSystem: (systemId: string) => void
  clearCurrentSystem: () => void
  
  // Setters will now directly update the active fields and then save to localStorage
  setRequirement: (requirement: string) => void
  pinAnalysis: (analysis: string) => void
  unpinAnalysis: () => void
  clearPinnedAnalysis: () => void
  setRequirementBook: (book: string) => void
  clearRequirementBook: () => void
  pinRequirementBook: (book: string) => void
  unpinRequirementBook: () => void
  clearPinnedRequirementBook: () => void
  setImageDraft: (draft: string) => void
  clearImageDraft: () => void

  // Method to get active analysis (no longer from a map)
  getActiveAnalysis: () => string | null
  getActiveRequirementBook: () => string | null
}

// 创建一个空的系统状态
const createEmptySystemState = (): SystemRequirementState => ({
  requirement: '',
  pinnedAnalysis: null,
  requirementBook: null,
  pinnedRequirementBook: null,
  isPinned: false,
  isRequirementBookPinned: false,
  imageDraft: null
})

// Initial state for the store - active fields will be empty until a system is loaded
const initialActiveSystemFields = createEmptySystemState();

// 创建Store
export const useRequirementAnalysisStore = create<ActiveSystemContextState>()(
  persist(
    (set, get) => ({
      // Initial state fields
      currentSystemId: null,
      isLoading: false,
      error: null,
      ...initialActiveSystemFields, // Spread the empty active fields
      
      setCurrentSystem: (systemId) => {
        if (!systemId) {
          // Clear active fields if systemId is nullified
          console.log('[setCurrentSystem] 系统ID为空，清除所有状态');
          set({ currentSystemId: null, ...createEmptySystemState(), isLoading: false, error: null });
          return;
        }
        if (get().currentSystemId === systemId && !get().isLoading) {
          console.log(`[setCurrentSystem] 系统 ${systemId} 已是当前系统且未在加载中，跳过重复加载`);
          // Potentially add a force reload option if needed later
          return;
        }

        // 记录加载前的状态
        const previousState = get();
        console.log(`[setCurrentSystem] 开始加载系统 ${systemId} 数据，当前系统ID: ${previousState.currentSystemId}`);
        console.log('[setCurrentSystem] 加载前状态:', {
          hasRequirementBook: !!previousState.requirementBook,
          hasPinnedRequirementBook: !!previousState.pinnedRequirementBook,
          isRequirementBookPinned: previousState.isRequirementBookPinned
        });

        // 加载前先检查localStorage中是否有数据
        const existingLocalData = loadSystemFromLocalStorage(systemId);
        
        // 设置加载状态
        // 注意: 这里不使用空状态覆盖现有数据，只设置最小必要的状态改变
        set({ isLoading: true, error: null, currentSystemId: systemId });

        try {
          console.log(`[setCurrentSystem] 从localStorage加载系统 ${systemId} 数据`);
          
          // 直接使用从localStorage加载的数据
          if (existingLocalData) {
            console.log(`[setCurrentSystem] 已从localStorage加载系统 ${systemId} 的数据:`, {
              hasRequirementBook: !!existingLocalData.requirementBook,
              hasPinnedRequirementBook: !!existingLocalData.pinnedRequirementBook
            });
            
            // 检查数据是否有内容
            const hasContent = !!(
              existingLocalData.requirementBook || 
              existingLocalData.pinnedRequirementBook ||
              (existingLocalData.requirement && existingLocalData.requirement.trim() !== '') ||
              existingLocalData.pinnedAnalysis ||
              existingLocalData.imageDraft
            );
            
            if (hasContent) {
              console.log(`[setCurrentSystem] 设置有效的系统数据`);
              set({ 
                ...existingLocalData, 
                currentSystemId: systemId,
                isLoading: false 
              });
            } else {
              console.log(`[setCurrentSystem] localStorage数据为空，使用默认空状态`);
              set({ 
                ...createEmptySystemState(),
                currentSystemId: systemId,
                isLoading: false 
              });
            }
          } else {
            console.log(`[setCurrentSystem] 系统 ${systemId} 在localStorage中无数据，使用默认空状态`);
            set({ 
              ...createEmptySystemState(),
              currentSystemId: systemId,
              isLoading: false 
            });
          }
        } catch (error) {
          console.error(`[setCurrentSystem] 加载系统 ${systemId} 数据过程中发生错误:`, error);
          
          // 出错时重置状态
          set({ 
            ...createEmptySystemState(),
            currentSystemId: systemId, 
            isLoading: false, 
            error: error instanceof Error ? error.message : '加载时发生错误' 
          });
        }
      },
      
      clearCurrentSystem: () => {
        const { currentSystemId, ...activeState } = get(); // Get all active fields except methods
        if (currentSystemId) {
          // Construct SystemRequirementState from active fields
          const currentSystemData: SystemRequirementState = {
            requirement: activeState.requirement,
            pinnedAnalysis: activeState.pinnedAnalysis,
            requirementBook: activeState.requirementBook,
            pinnedRequirementBook: activeState.pinnedRequirementBook,
            isPinned: activeState.isPinned,
            isRequirementBookPinned: activeState.isRequirementBookPinned,
            imageDraft: activeState.imageDraft,
          };
          // Save current active state to its localStorage before clearing
          saveSystemToLocalStorage(currentSystemId, currentSystemData);
        }
        set({ currentSystemId: null, ...createEmptySystemState(), isLoading: false, error: null });
      },
      
      // Example for setRequirement, others will follow this pattern
      setRequirement: (newRequirement) => {
        const systemId = get().currentSystemId;
        if (!systemId) return;

        set({ requirement: newRequirement });
        const updatedState: SystemRequirementState = {
          requirement: newRequirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: get().isPinned,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      pinAnalysis: (analysis) => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ pinnedAnalysis: analysis, isPinned: true });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: analysis,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: true,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      unpinAnalysis: () => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ isPinned: false }); // Keep pinnedAnalysis content, just mark as not active
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis, // Keep current pinned content
          requirementBook: get().requirementBook,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: false,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      clearPinnedAnalysis: () => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ pinnedAnalysis: null, isPinned: false });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: null,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: false,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      setRequirementBook: (book) => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ requirementBook: book });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: book,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: get().isPinned,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      clearRequirementBook: () => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ requirementBook: null });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: null,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: get().isPinned,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      pinRequirementBook: (book) => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ pinnedRequirementBook: book, isRequirementBookPinned: true });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: book,
          isPinned: get().isPinned,
          isRequirementBookPinned: true,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      unpinRequirementBook: () => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ isRequirementBookPinned: false });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: get().pinnedRequirementBook, // Keep current pinned content
          isPinned: get().isPinned,
          isRequirementBookPinned: false,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      clearPinnedRequirementBook: () => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ pinnedRequirementBook: null, isRequirementBookPinned: false });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: null,
          isPinned: get().isPinned,
          isRequirementBookPinned: false,
          imageDraft: get().imageDraft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      setImageDraft: (draft) => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ imageDraft: draft });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: get().isPinned,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: draft,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      clearImageDraft: () => {
        const systemId = get().currentSystemId;
        if (!systemId) return;
        set({ imageDraft: null });
        const updatedState: SystemRequirementState = {
          requirement: get().requirement,
          pinnedAnalysis: get().pinnedAnalysis,
          requirementBook: get().requirementBook,
          pinnedRequirementBook: get().pinnedRequirementBook,
          isPinned: get().isPinned,
          isRequirementBookPinned: get().isRequirementBookPinned,
          imageDraft: null,
        };
        saveSystemToLocalStorage(systemId, updatedState);
      },

      getActiveAnalysis: () => {
        // Now directly returns the active state field
        if (!get().currentSystemId) return null;
        return get().isPinned ? get().pinnedAnalysis : null; // Logic might need review based on direct active fields
      },

      getActiveRequirementBook: () => {
        if (!get().currentSystemId) return null;
        return get().isRequirementBookPinned ? get().pinnedRequirementBook : null;
      }
    }),
    {
      name: 'requirement-analysis-session-store', // Renamed localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist currentSystemId. Active fields are loaded from their own localStorage entries.
        currentSystemId: state.currentSystemId,
      }),
    }
  )
)

// 在页面卸载前保存当前系统状态到localStorage
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const store = useRequirementAnalysisStore.getState();
    const systemId = store.currentSystemId;
    
    if (systemId) {
      // 检查当前store中的数据是否有价值
      const storeHasValue = !!(
        store.requirementBook || 
        store.pinnedRequirementBook || 
        (store.requirement && store.requirement.trim() !== '') ||
        store.pinnedAnalysis ||
        store.imageDraft
      );
      
      // 如果当前正在加载，不保存数据以避免覆盖
      if (store.isLoading) {
        console.log(`[beforeunload] 系统 ${systemId} 正在加载中，跳过保存`);
        return;
      }
      
      // 如果当前数据有价值，直接保存到localStorage
      if (storeHasValue) {
        // 构建当前数据
        const currentData: SystemRequirementState = {
          requirement: store.requirement,
          pinnedAnalysis: store.pinnedAnalysis,
          requirementBook: store.requirementBook,
          pinnedRequirementBook: store.pinnedRequirementBook,
          isPinned: store.isPinned,
          isRequirementBookPinned: store.isRequirementBookPinned,
          imageDraft: store.imageDraft,
        };
        
        console.log(`[beforeunload] 保存系统 ${systemId} 数据到localStorage`);
        
        // 保存到localStorage
        saveSystemToLocalStorage(systemId, currentData);
      } else {
        // 如果当前数据为空，检查localStorage中是否有数据
        try {
          const existingData = loadSystemFromLocalStorage(systemId);
          if (existingData && (
            existingData.requirementBook || 
            existingData.pinnedRequirementBook ||
            (existingData.requirement && existingData.requirement.trim() !== '') ||
            existingData.pinnedAnalysis ||
            existingData.imageDraft
          )) {
            console.log(`[beforeunload] 当前系统 ${systemId} 数据为空，但localStorage中有数据，不覆盖`);
          } else {
            console.log(`[beforeunload] 当前系统 ${systemId} 数据为空，localStorage中也无数据，跳过保存`);
          }
        } catch (e) { /* 忽略错误 */ }
      }
    }
  });
}


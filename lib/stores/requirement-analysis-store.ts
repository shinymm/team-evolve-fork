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
    localStorage.removeItem(getSystemLocalStorageKey(systemId)); // Remove corrupted item
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

  saveCurrentSystemToRedis: () => Promise<void>
  // cleanupCacheData: (keepRecentCount?: number) => void; // This will be removed or rethought
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
      
      setCurrentSystem: async (systemId) => {
        if (!systemId) {
          // Clear active fields if systemId is nullified
          set({ currentSystemId: null, ...createEmptySystemState(), isLoading: false, error: null });
          return;
        }
        if (get().currentSystemId === systemId && !get().isLoading) {
          // console.log(`System ${systemId} is already current and not loading.`);
          // Potentially add a force reload option if needed later
          return;
        }

        set({ isLoading: true, error: null, currentSystemId: systemId }); // Set currentSystemId here

        try {
          const response = await fetch(`/api/system-cache/${systemId}/requirement-analysis`);
          let systemDataToSetActive: SystemRequirementState;

          if (response.ok) {
            const data = await response.json();
            systemDataToSetActive = data.systemState ? { ...createEmptySystemState(), ...data.systemState } : createEmptySystemState();
            console.log(`已从Redis加载系统 ${systemId} 的数据`);
          } else if (response.status === 404) {
            console.log(`系统 ${systemId} 在Redis中无数据，尝试从localStorage加载`);
            const localData = loadSystemFromLocalStorage(systemId);
            if (localData) {
              systemDataToSetActive = localData;
              console.log(`已从localStorage加载系统 ${systemId} 的数据`);
            } else {
              console.log(`系统 ${systemId} 在localStorage中也无数据，创建空状态`);
              systemDataToSetActive = createEmptySystemState();
            }
          } else {
            console.error(`从Redis加载系统 ${systemId} 数据失败: ${response.statusText} (status: ${response.status})`);
            const localData = loadSystemFromLocalStorage(systemId); // Fallback to localStorage on other errors
            if (localData) {
              systemDataToSetActive = localData;
              console.warn(`Redis加载失败后，已从localStorage加载系统 ${systemId} 的数据`);
              set({ error: `Redis加载失败: ${response.statusText}, 已从localStorage恢复` })
            } else {
              systemDataToSetActive = createEmptySystemState();
              console.warn(`系统 ${systemId} 在Redis和localStorage均加载失败，创建空状态`);
              set({ error: `Redis加载失败: ${response.statusText}, localStorage也无数据` });
            }
          }
          
          set({ 
            ...systemDataToSetActive, // Update active fields in the store
            currentSystemId: systemId, // Ensure currentSystemId is correctly set 
            isLoading: false 
          });
          saveSystemToLocalStorage(systemId, systemDataToSetActive); // Sync to its localStorage entry

        } catch (error) {
          console.error(`加载系统 ${systemId} 数据过程中发生严重错误:`, error);
          const localData = loadSystemFromLocalStorage(systemId); // Final fallback
          if (localData) {
            set({ ...localData, currentSystemId: systemId, isLoading: false, error: error instanceof Error ? error.message : '加载时发生严重错误，已从localStorage恢复' });
            saveSystemToLocalStorage(systemId, localData);
          } else {
            set({ ...createEmptySystemState(), currentSystemId: systemId, isLoading: false, error: error instanceof Error ? error.message : '加载时发生严重错误' });
            saveSystemToLocalStorage(systemId, createEmptySystemState());
          }
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
          // Then try to save to Redis
          // Note: saveCurrentSystemToRedis will read from the store, which is about to be cleared,
          // so we rely on the localStorage save + what saveCurrentSystemToRedis reconstructs.
          // A direct call with currentSystemData might be safer if debouncing is an issue here.
          get().saveCurrentSystemToRedis() 
             .catch(error => console.error(`[clearCurrentSystem] 保存系统 ${currentSystemId} 数据到Redis失败:`, error));
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
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
        debouncedSaveCurrentSystemToRedis(systemId, get);
      },

      getActiveAnalysis: () => {
        // Now directly returns the active state field
        if (!get().currentSystemId) return null;
        return get().isPinned ? get().pinnedAnalysis : null; // Logic might need review based on direct active fields
      },

      getActiveRequirementBook: () => {
        if (!get().currentSystemId) return null;
        return get().isRequirementBookPinned ? get().pinnedRequirementBook : null;
      },
      
      saveCurrentSystemToRedis: async () => {
        const { currentSystemId, ...activeState } = get();
        if (!currentSystemId) {
          console.warn('[saveCurrentSystemToRedis] No currentSystemId.');
          return;
        }

        const systemDataToSave: SystemRequirementState = {
            requirement: activeState.requirement,
            pinnedAnalysis: activeState.pinnedAnalysis,
            requirementBook: activeState.requirementBook,
            pinnedRequirementBook: activeState.pinnedRequirementBook,
            isPinned: activeState.isPinned,
            isRequirementBookPinned: activeState.isRequirementBookPinned,
            imageDraft: activeState.imageDraft,
        };
        
        console.log(`[saveCurrentSystemToRedis] Attempting to save for systemId: ${currentSystemId}`, systemDataToSave);
        saveSystemToLocalStorage(currentSystemId, systemDataToSave); // Ensure localStorage is in sync

        try {
          const response = await fetch(`/api/system-cache/${currentSystemId}/requirement-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemState: systemDataToSave })
          });
          if (!response.ok) {
            const errorData = await response.text();
            console.error(`[saveCurrentSystemToRedis] 保存系统 ${currentSystemId} 数据失败: ${response.statusText}`, errorData);
            throw new Error(`保存到Redis API失败: ${response.statusText}`);
          }
          console.log(`[saveCurrentSystemToRedis] 已成功保存系统 ${currentSystemId} 的数据到Redis`);
        } catch (error) {
          console.error(`[saveCurrentSystemToRedis] 保存数据到Redis失败 (systemId: ${currentSystemId}):`, error);
          set({ error: error instanceof Error ? error.message : '保存到Redis失败' });
        }
      },
      // cleanupCacheData will be removed as it's no longer relevant for systemRequirements map
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

// Debounce function needs to be adjusted to call get().saveCurrentSystemToRedis()
// and not expect systemId as an argument if it always saves the *current* one.
let saveTimeout: NodeJS.Timeout | null = null;
const debouncedSaveCurrentSystemToRedis = (systemId: string, storeGet: () => ActiveSystemContextState) => { // systemId might be redundant if we always save current
  if (typeof window === 'undefined') return;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    // const currentId = storeGet().currentSystemId; // Get the ID at the moment of execution
    // if (currentId) { // only save if there is a current system
         storeGet().saveCurrentSystemToRedis()
          .catch(error => console.error('[debouncedSave] 自动保存到Redis失败:', error));
    // }
    saveTimeout = null;
  }, 5000);
};

// beforeunload logic needs to be updated to use saveCurrentSystemToRedis
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const store = useRequirementAnalysisStore.getState();
    if (store.currentSystemId) {
      // Construct the data from current store active fields
      const systemDataToSave: SystemRequirementState = {
        requirement: store.requirement,
        pinnedAnalysis: store.pinnedAnalysis,
        requirementBook: store.requirementBook,
        pinnedRequirementBook: store.pinnedRequirementBook,
        isPinned: store.isPinned,
        isRequirementBookPinned: store.isRequirementBookPinned,
        imageDraft: store.imageDraft,
      };
      saveSystemToLocalStorage(store.currentSystemId, systemDataToSave); // Final sync to localStorage

      // Attempt to save to Redis using sendBeacon or sync XHR
      const payload = JSON.stringify({ systemState: systemDataToSave });
      const apiUrl = `/api/system-cache/${store.currentSystemId}/requirement-analysis`;
      if (navigator.sendBeacon) {
        try {
          if (!navigator.sendBeacon(apiUrl, payload)) {
            console.warn('[beforeunload] Beacon failed, attempting sync XHR for system:', store.currentSystemId);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', apiUrl, false); 
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(payload);
          }
        } catch (e) {
          console.error('[beforeunload] Error sending beacon, falling back to XHR', e);
          const xhr = new XMLHttpRequest();
          xhr.open('POST', apiUrl, false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(payload);
        }
      } else {
        console.log('[beforeunload] Using sync XHR for system:', store.currentSystemId);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        try { xhr.send(payload); } catch (error) {
          console.error('[beforeunload] Sync XHR send failed:', error);
        }
      }
    }
  });
}


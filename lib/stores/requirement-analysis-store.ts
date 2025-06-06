import { create } from 'zustand'
import type { UploadedFile } from '@/components/image-processing/ImageList'

// Define a specific localStorage key prefix for individual system data
// 注意：系统数据键名不应该与语言相关，保持统一
const SYSTEM_DATA_LOCAL_STORAGE_PREFIX = 'req_analysis_system_'

// 当前系统ID的存储键名
const CURRENT_SYSTEM_ID_KEY = 'req_analysis_current_system_id'

// Helper to generate localStorage key for a system
// 确保不同语言环境下使用相同的键名
const getSystemLocalStorageKey = (systemId: string) => `${SYSTEM_DATA_LOCAL_STORAGE_PREFIX}${systemId}`

// 从localStorage获取当前系统ID
const getCurrentSystemIdFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(CURRENT_SYSTEM_ID_KEY)
  } catch (error) {
    console.error('Error loading current system ID from localStorage:', error)
    return null
  }
}

// 保存当前系统ID到localStorage
const saveCurrentSystemIdToStorage = (systemId: string | null) => {
  if (typeof window === 'undefined') return
  try {
    if (systemId) {
      localStorage.setItem(CURRENT_SYSTEM_ID_KEY, systemId)
    } else {
      localStorage.removeItem(CURRENT_SYSTEM_ID_KEY)
    }
  } catch (error) {
    console.error('Error saving current system ID to localStorage:', error)
  }
}

// Helper to load a single system's state from localStorage
const loadSystemFromLocalStorage = (systemId: string): SystemRequirementState | null => {
  if (typeof window === 'undefined') return null
  try {
    const item = localStorage.getItem(getSystemLocalStorageKey(systemId))
    if (item) {
      const parsed = JSON.parse(item);
      // 后处理：将 uploadedFiles 中的日期字符串转换为 Date 对象
      if (parsed.uploadedFiles && Array.isArray(parsed.uploadedFiles)) {
        parsed.uploadedFiles.forEach((file: any) => {
          if (file.uploadTime && typeof file.uploadTime === 'string') {
            file.uploadTime = new Date(file.uploadTime);
          }
        });
      }
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
  
  // 新增：需求书模板ID
  templateId: string | null

  // 新增：上传的文件列表
  uploadedFiles: UploadedFile[]
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
  // 新增：设置模板ID的方法
  setTemplateId: (templateId: string) => void
  clearTemplateId: () => void
  // 新增：设置上传文件列表的方法
  setUploadedFiles: (files: UploadedFile[]) => void

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
  imageDraft: null,
  templateId: null,
  uploadedFiles: []
})

// Initial state for the store - active fields will be empty until a system is loaded
const initialActiveSystemFields = createEmptySystemState();

// 创建Store - 不再使用persist，自己管理持久化
export const useRequirementAnalysisStore = create<ActiveSystemContextState>()((set, get) => {
  // 尝试从localStorage加载当前系统ID
  const savedSystemId = typeof window !== 'undefined' ? getCurrentSystemIdFromStorage() : null;
  
  // 如果有当前系统ID，尝试加载其数据
  let initialState: SystemRequirementState = initialActiveSystemFields;
  if (savedSystemId) {
    const savedData = loadSystemFromLocalStorage(savedSystemId);
    if (savedData) {
      initialState = savedData;
    }
  }
  
  return {
    // 初始状态，包括从localStorage加载的数据
    currentSystemId: savedSystemId,
    isLoading: false,
    error: null,
    ...initialState,
    
    setCurrentSystem: (systemId) => {
      if (!systemId) {
        // Clear active fields if systemId is nullified
        console.log('[setCurrentSystem] System ID is empty, clearing all states');
        saveCurrentSystemIdToStorage(null);
        set({ currentSystemId: null, ...createEmptySystemState(), isLoading: false, error: null });
        return;
      }
      
      // 已经是当前系统且未在加载，跳过重复加载
      if (get().currentSystemId === systemId && !get().isLoading) {
        console.log(`[setCurrentSystem] System ${systemId} is already the current system and not loading, skipping`);
        return;
      }

      // 记录加载前的状态
      const previousState = get();
      console.log(`[setCurrentSystem] Starting to load system ${systemId} data, current system ID: ${previousState.currentSystemId}`);
      console.log('[setCurrentSystem] State before loading:', {
        hasRequirementBook: !!previousState.requirementBook,
        hasPinnedRequirementBook: !!previousState.pinnedRequirementBook,
        isRequirementBookPinned: previousState.isRequirementBookPinned,
        locale: typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'unknown' // 记录当前语言环境
      });

      // 加载前先检查localStorage中是否有数据
      const existingLocalData = loadSystemFromLocalStorage(systemId);
      
      // 先保存当前系统ID到localStorage，以便在页面刷新或语言切换后能够恢复
      saveCurrentSystemIdToStorage(systemId);
      
      // 设置加载状态
      // 注意: 这里不使用空状态覆盖现有数据，只设置最小必要的状态改变
      set({ isLoading: true, error: null, currentSystemId: systemId });

      try {
        console.log(`[setCurrentSystem] Loading system ${systemId} data from localStorage`);
        
        // 直接使用从localStorage加载的数据
        if (existingLocalData) {
          console.log(`[setCurrentSystem] Successfully loaded system ${systemId} data from localStorage:`, {
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
            console.log(`[setCurrentSystem] Setting valid system data`);
            set({ 
              ...existingLocalData, 
              currentSystemId: systemId,
              isLoading: false 
            });
          } else {
            console.log(`[setCurrentSystem] localStorage data is empty, using default empty state`);
            set({ 
              ...createEmptySystemState(),
              currentSystemId: systemId,
              isLoading: false 
            });
          }
        } else {
          console.log(`[setCurrentSystem] System ${systemId} has no data in localStorage, using default empty state`);
          set({ 
            ...createEmptySystemState(),
            currentSystemId: systemId,
            isLoading: false 
          });
        }
      } catch (error) {
        console.error(`[setCurrentSystem] Error occurred while loading system ${systemId} data:`, error);
        
        // 出错时重置状态
        set({ 
          ...createEmptySystemState(),
          currentSystemId: systemId, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Error occurred during loading' 
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
          templateId: activeState.templateId,
          uploadedFiles: activeState.uploadedFiles,
        };
        // Save current active state to its localStorage before clearing
        saveSystemToLocalStorage(currentSystemId, currentSystemData);
      }
      
      // 清除本地存储中的当前系统ID
      saveCurrentSystemIdToStorage(null);
      
      // 重置状态
      set({ currentSystemId: null, ...createEmptySystemState(), isLoading: false, error: null });
    },
    
    // 所有状态修改方法，改为直接更新本地存储
    setRequirement: (newRequirement) => {
      const systemId = get().currentSystemId;
      if (!systemId) return;

      set({ requirement: newRequirement });
      
      // 构建当前数据并保存到localStorage
      const updatedState: SystemRequirementState = {
        requirement: newRequirement,
        pinnedAnalysis: get().pinnedAnalysis,
        requirementBook: get().requirementBook,
        pinnedRequirementBook: get().pinnedRequirementBook,
        isPinned: get().isPinned,
        isRequirementBookPinned: get().isRequirementBookPinned,
        imageDraft: get().imageDraft,
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
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
        templateId: get().templateId,
        uploadedFiles: get().uploadedFiles,
      };
      saveSystemToLocalStorage(systemId, updatedState);
    },

    getActiveAnalysis: () => {
      // Now directly returns the active state field
      if (!get().currentSystemId) return null;
      return get().isPinned ? get().pinnedAnalysis : null;
    },

    getActiveRequirementBook: () => {
      if (!get().currentSystemId) return null;
      return get().isRequirementBookPinned ? get().pinnedRequirementBook : null;
    },

    // 新增：设置模板ID
    setTemplateId: (templateId) => {
      const systemId = get().currentSystemId;
      if (!systemId) return;
      
      set({ templateId });
      
      const updatedState: SystemRequirementState = {
        requirement: get().requirement,
        pinnedAnalysis: get().pinnedAnalysis,
        requirementBook: get().requirementBook,
        pinnedRequirementBook: get().pinnedRequirementBook,
        isPinned: get().isPinned,
        isRequirementBookPinned: get().isRequirementBookPinned,
        imageDraft: get().imageDraft,
        templateId,
        uploadedFiles: get().uploadedFiles,
      };
      saveSystemToLocalStorage(systemId, updatedState);
    },
    
    // 新增：清除模板ID
    clearTemplateId: () => {
      const systemId = get().currentSystemId;
      if (!systemId) return;
      
      set({ templateId: null });
      
      const updatedState: SystemRequirementState = {
        requirement: get().requirement,
        pinnedAnalysis: get().pinnedAnalysis,
        requirementBook: get().requirementBook,
        pinnedRequirementBook: get().pinnedRequirementBook,
        isPinned: get().isPinned,
        isRequirementBookPinned: get().isRequirementBookPinned,
        imageDraft: get().imageDraft,
        templateId: null,
        uploadedFiles: get().uploadedFiles,
      };
      saveSystemToLocalStorage(systemId, updatedState);
    },

    // 新增：设置上传文件列表
    setUploadedFiles: (files) => {
      const systemId = get().currentSystemId;
      if (!systemId) return;
      
      set({ uploadedFiles: files });
      
      const updatedState: SystemRequirementState = {
        requirement: get().requirement,
        pinnedAnalysis: get().pinnedAnalysis,
        requirementBook: get().requirementBook,
        pinnedRequirementBook: get().pinnedRequirementBook,
        isPinned: get().isPinned,
        isRequirementBookPinned: get().isRequirementBookPinned,
        imageDraft: get().imageDraft,
        templateId: get().templateId,
        uploadedFiles: files,
      };
      saveSystemToLocalStorage(systemId, updatedState);
    }
  };
})


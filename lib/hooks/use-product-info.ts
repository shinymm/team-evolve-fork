import { useState, useEffect } from 'react'
import { ArchitectureItem, Overview, UserNeeds, UserNeedsItem } from '@/types/product-info'
import {
  getProductInfo,
  saveArchitecture,
  saveOverview,
  saveUserNeeds,
  buildArchitectureTree,
  flattenArchitectureTree,
  generateArchitectureId
} from '@/lib/services/product-info-service'

export const useProductInfo = () => {
  const [flatArchitecture, setFlatArchitecture] = useState<ArchitectureItem[]>([])
  const [overview, setOverview] = useState<Overview>({ title: '', content: '' })
  const [userNeeds, setUserNeeds] = useState<UserNeeds>({ title: '', items: [] })

  // 加载初始数据
  useEffect(() => {
    const productInfo = getProductInfo()
    setFlatArchitecture(productInfo.architecture)
    setOverview(productInfo.overview)
    setUserNeeds(productInfo.userNeeds)
  }, [])

  // 架构相关方法
  const addArchitectureItem = (title: string, description: string, parentId?: string) => {
    const newItem: ArchitectureItem = {
      id: generateArchitectureId(parentId),
      title,
      description,
      parentId
    }
    const newArchitecture = [...flatArchitecture, newItem]
    setFlatArchitecture(newArchitecture)
    saveArchitecture(newArchitecture)
  }

  const updateArchitectureItem = (id: string, title: string, description: string) => {
    const newArchitecture = flatArchitecture.map(item =>
      item.id === id ? { ...item, title, description } : item
    )
    setFlatArchitecture(newArchitecture)
    saveArchitecture(newArchitecture)
  }

  const deleteArchitectureItem = (id: string) => {
    const newArchitecture = flatArchitecture.filter(item => 
      item.id !== id && item.parentId !== id
    )
    setFlatArchitecture(newArchitecture)
    saveArchitecture(newArchitecture)
  }

  const getArchitectureTree = () => buildArchitectureTree(flatArchitecture)

  // 概述相关方法
  const updateOverview = (newOverview: Overview) => {
    setOverview(newOverview)
    saveOverview(newOverview)
  }

  // 用户需求相关方法
  const addUserNeed = (title: string, features: string, needs: string) => {
    const newItem: UserNeedsItem = {
      id: String(new Date().getTime()),
      title,
      features,
      needs
    }
    const newUserNeeds = {
      ...userNeeds,
      items: [...userNeeds.items, newItem]
    }
    setUserNeeds(newUserNeeds)
    saveUserNeeds(newUserNeeds)
  }

  const updateUserNeed = (id: string, title: string, features: string, needs: string) => {
    const newUserNeeds = {
      ...userNeeds,
      items: userNeeds.items.map(item =>
        item.id === id ? { ...item, title, features, needs } : item
      )
    }
    setUserNeeds(newUserNeeds)
    saveUserNeeds(newUserNeeds)
  }

  const deleteUserNeed = (id: string) => {
    const newUserNeeds = {
      ...userNeeds,
      items: userNeeds.items.filter(item => item.id !== id)
    }
    setUserNeeds(newUserNeeds)
    saveUserNeeds(newUserNeeds)
  }

  return {
    // 数据
    flatArchitecture,
    overview,
    userNeeds,
    
    // 架构方法
    addArchitectureItem,
    updateArchitectureItem,
    deleteArchitectureItem,
    getArchitectureTree,
    
    // 概述方法
    updateOverview,
    
    // 用户需求方法
    addUserNeed,
    updateUserNeed,
    deleteUserNeed
  }
} 
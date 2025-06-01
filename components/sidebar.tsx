'use client'

import { ChevronDown, Settings, Database, Microscope, Flame, Hexagon, Sparkles } from 'lucide-react'
import { usePathname } from "next/navigation" // usePathname from next/navigation is fine
import { useState, useEffect } from "react"
import { useSession } from 'next-auth/react'
import { getPathPermission } from '@/config/permissions'
import { toast } from '@/components/ui/use-toast'
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation'; // USE THIS ROUTER
import { routing } from '@/i18n/routing'; // Added for dynamic locale regex

type UserRole = 'USER' | 'ADMIN'

interface MenuItemDef {
  titleKey: string
  icon: React.ReactNode
  href?: string
  submenu?: SubMenuItemDef[]
}

interface SubMenuItemDef {
  titleKey: string
  href: string
  isPro?: boolean
}

// Construct a regex to remove locale prefixes dynamically
const localesRegexSegment = routing.locales.join('|');
const localePrefixRegex = new RegExp(`^\/(${localesRegexSegment})`);
const localePrefixWithSlashRegex = new RegExp(`^\/(${localesRegexSegment})\/`);

export function Sidebar() {
  const t = useTranslations('Sidebar');
  const pathname = usePathname() 
  const router = useRouter() 
  const { data: session } = useSession()
  
  // Menu definitions using titleKey for translation
  // It's better to define these outside the component if they don't depend on component's state/props,
  // or memoize them with useMemo if they do. For simplicity, defined here.
  const mainMenuItems: MenuItemDef[] = [
    {
      titleKey: "aiCapabilityEcosystem",
      icon: <Flame className="h-4 w-4" />,
      submenu: [
        { titleKey: "aiTeamMembers", href: "/settings/ai-team-members" },
        { titleKey: "aiTeamApplications", href: "/settings/ai-team-applications" }
      ]
    },
    {
      titleKey: "aiCapabilityCapsule",
      icon: <Microscope className="h-4 w-4" />,
      submenu: [
        { titleKey: "rawRequirementAnalysis", href: "/ai-capability/book-evolution" },
        { titleKey: "draftRequirementEvolution", href: "/ai-capability/book" },
        { titleKey: "sceneBoundaryAnalysis", href: "/ai-capability/scene-analysis" },
        { titleKey: "requirementDocConfirm", href: "/ai-capability/book-confirm" },
        { titleKey: "requirementDocWriting", href: "/ai-capability/book-writing", isPro: true },
        { titleKey: "userStoryDecomposition", href: "/ai-capability/user-story" },
        { titleKey: "testCaseGeneration", href: "/ai-capability/test-cases" },
        { titleKey: "testDescriptionFormat", href: "/ai-capability/test-format" },
        { titleKey: "testCaseDetailAssistant", href: "/ai-capability/test-detail" },
        { titleKey: "logAnalysis", href: "/ai-capability/log-analysis" },
      ]
    },
    {
      titleKey: "knowledgeForge",
      icon: <Database className="h-4 w-4" />,
      submenu: [
        { titleKey: "productInfoArchitecture", href: "/knowledge/information-architecture" },
        { titleKey: "productSystemArchitecture", href: "/knowledge/system-architecture" },
        { titleKey: "productOpenAPI", href: "/knowledge/api-interfaces" },
        { titleKey: "glossaryManagement", href: "/knowledge/glossary" },
        { titleKey: "requirementSummaryManagement", href: "/knowledge/requirement-summaries" },
        { titleKey: "requirementTemplate", href: "/knowledge/requirement-templates" },
        { titleKey: "boundaryIdentificationKnowledge", href: "/knowledge/boundary", isPro: true },
      ]
    },
    {
      titleKey: "inspirationPavilion",
      icon: <Sparkles className="h-4 w-4" />,
      submenu: [
        { titleKey: "reqAnalysisSkill", href: "/inspire/req-analysis-skill", isPro: true },
        { titleKey: "docComprehensiveProcessing", href: "/special-capability/requirement-upload", isPro: true },
        { titleKey: "imageComprehensiveProcessing", href: "/special-capability/image-processing", isPro: true }
      ]
    }
  ];
  
  const settingsMenu: MenuItemDef = {
    titleKey: "settings",
    icon: <Settings className="h-4 w-4" />,
    submenu: [
      { titleKey: "llmSettings", href: "/settings/ai-models" },
      { titleKey: "promptDebug", href: "/special-capability/prompt-debug"}
    ]
  };

  // Use titleKey for managing open state, as it's the stable identifier
  const [openMenus, setOpenMenus] = useState<string[]>([mainMenuItems[1].titleKey]); // Default open "AI能力胶囊" by its key
  const [navigating, setNavigating] = useState<string | null>(null)

  useEffect(() => {
    mainMenuItems.forEach(item => {
      item.submenu?.forEach(subitem => {
        router.prefetch(subitem.href);
      })
    })
    settingsMenu.submenu?.forEach(subitem => {
      router.prefetch(subitem.href)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // router is stable, menu items are stable if defined outside or memoized

  const toggleMenu = (menuTitleKey: string) => {
    setOpenMenus(prev =>
      prev.includes(menuTitleKey)
        ? prev.filter(item => item !== menuTitleKey)
        : [...prev, menuTitleKey]
    )
  }

  const canAccessPath = (path: string) => {
    const permission = getPathPermission(path)
    if (!permission) return true
    if (!permission.requiresAuth) return true
    if (!session?.user) return false
    if (!permission.allowedRoles) return true
    const userRole = session.user.role as UserRole
    return permission.allowedRoles.includes(userRole)
  }

  const getPathWithoutLocale = (currentPath: string) => {
    // First, try to remove /<locale>/ (e.g., /en/foo -> foo)
    let path = currentPath.replace(localePrefixWithSlashRegex, '');
    // If that didn't change anything, it might be just /<locale> (e.g., /en -> )
    // So, try removing /<locale> (e.g. /en -> )
    if (path === currentPath) { 
      path = currentPath.replace(localePrefixRegex, '');
    }
    return path || '/'; // Ensure root path is represented as '/'
  };

  const handleNavigate = async (href: string) => {
    if (!canAccessPath(href)) {
      toast({
        title: t('accessDenied'),
        description: t('loginOrPermissionRequired'),
        variant: "destructive"
      })
      return
    }

    const currentPathWithoutLocale = getPathWithoutLocale(pathname);
    if (href !== currentPathWithoutLocale) {
      setNavigating(href)
      // router.push from @/i18n/navigation will handle locale automatically
      await router.push(href) 
      setNavigating(null)
    }
  }

  useEffect(() => {
    setNavigating(null)
  }, [pathname])

  const renderMenuItem = (item: MenuItemDef) => {
    if (!item.submenu) return null
    
    // Use item.titleKey for logic, t(item.titleKey) for display
    const translatedTitle = t(item.titleKey as any); 

    const hasAccessibleSubmenu = item.submenu.some(sub => canAccessPath(sub.href))
    if (!hasAccessibleSubmenu) return null

    return (
      <div key={item.titleKey} className="mb-0"> {/* Use stable titleKey for React key */}
        <div
          className="w-full flex items-center justify-between px-1.5 py-1 text-[12px] text-gray-600 font-medium bg-gray-100/80 rounded-md cursor-default select-none"
        >
          <div className="flex items-center gap-1">
            {item.icon}
            <span>{translatedTitle}</span>
          </div>
          <ChevronDown
            className={`h-2.5 w-2.5 transition-transform text-gray-400 ${
              openMenus.includes(item.titleKey) ? "transform rotate-180" : "" // Check against titleKey
            }`}
            onClick={() => toggleMenu(item.titleKey)} // Toggle using titleKey
          />
        </div>
        {openMenus.includes(item.titleKey) && (
          <div className="space-y-0">
            {item.submenu.map((subitem) => {
              const isAccessible = canAccessPath(subitem.href);
              const translatedSubitemTitle = t(subitem.titleKey as any);
              const currentPathWithoutLocale = getPathWithoutLocale(pathname);
              return (
                <button
                  key={subitem.href} 
                  onClick={() => handleNavigate(subitem.href)}
                  className={`w-full text-left pl-6 pr-1 py-1 text-[12px] relative block
                    ${!isAccessible ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-100 hover:text-orange-700'}
                    ${currentPathWithoutLocale === subitem.href ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-700"}
                    ${navigating === subitem.href ? "opacity-70" : ""}`}
                  disabled={navigating === subitem.href || !isAccessible}
                >
                  <span className="relative inline-block">
                    {translatedSubitemTitle}
                    {subitem.isPro && (
                      <span className="absolute -top-0.5 -right-5 text-[8px] font-semibold text-orange-600">
                        PRO
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-40 border-r bg-gray-50/50 h-[calc(100vh-3.5rem)] sticky top-14 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <nav className="p-1 space-y-1">
          {mainMenuItems.map(renderMenuItem)}
        </nav>
      </div>
      <div className="border-t">
        <div className="p-0.5">
          {renderMenuItem(settingsMenu)}
        </div>
      </div>
    </div>
  )
}
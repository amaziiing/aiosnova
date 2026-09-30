import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  collectAncestorGroupIds,
  filterSidebarSections,
  findModuleByPath,
  type SidebarLink,
  type SidebarNode,
  type SidebarSection,
} from '@/navigation/sidebarNav'
import { BrandLogo } from '@/components/brand/BrandLogo'
import {
  getLinkIcon,
  getModuleIcon,
  getSectionIcon,
  IconBuilding,
  IconChevron,
  IconLogout,
  IconMinus,
  IconPlus,
  IconSearch,
} from '@/components/navigation/SidebarIcons'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { logout } from '@/modules/core/auth/services/authService'
import { fetchCompanies } from '@/modules/core/identity/services/identityService'
import type { CompanyRecord } from '@/modules/core/identity/types/identity'
import type { CompanyGroupRecord } from '@/mocks/data/identity'
import './Sidebar.css'

const GROUP_COMPANIES_LABEL = 'GROUP COMPANIES'
const COLLAPSED_STORAGE_KEY = 'aios.sidebar.collapsed'

/**
 * Grace period before hover-opened popovers close. Has to be long enough to
 * cross the gap between two stacked flyouts (or move onto a side panel).
 */
const POPOVER_HIDE_DELAY_MS = 320

/**
 * Sections that keep expanding inline inside the sidebar. Every other section
 * opens its module list in a panel anchored to the right of the sidebar.
 * (Overview and AI render their single module directly - see `hideLabel`.)
 */
const INLINE_SECTION_IDS = new Set(['overview', 'ai'])

/**
 * A section is worth a chooser panel only when it actually offers a choice.
 * Single-module sections (Platform Admin) and the inline ones (Dashboard, AI)
 * get a plain name tip on the collapsed rail instead.
 */
function hasModuleChoice(section: SidebarSection): boolean {
  if (INLINE_SECTION_IDS.has(section.id)) {
    return false
  }
  return section.children.filter((node) => node.kind === 'group').length > 1
}

type CompanyOption = { value: string; label: string }

type Level2Item =
  | { kind: 'group'; id: string; label: string; companies: CompanyOption[] }
  | { kind: 'company'; id: string; label: string }

function toCompanyOptions(items: Array<Pick<CompanyRecord, 'id' | 'name' | 'status'>>): CompanyOption[] {
  return items
    .filter((item) => item.status === 'active')
    .map((item) => ({ value: item.id, label: item.name }))
}

function buildLevel2Items(
  companies: CompanyOption[],
  groups: CompanyGroupRecord[],
): Level2Item[] {
  const companyMap = new Map(companies.map((item) => [item.value, item]))
  const groupedIds = new Set(groups.flatMap((group) => group.companyIds))

  const groupItems: Level2Item[] = groups.map((group) => ({
    kind: 'group',
    id: group.id,
    label: group.name,
    companies: group.companyIds
      .map((id) => companyMap.get(id))
      .filter((item): item is CompanyOption => Boolean(item)),
  }))

  const standalone: Level2Item[] = companies
    .filter((item) => !groupedIds.has(item.value))
    .map((item) => ({ kind: 'company', id: item.value, label: item.label }))

  return [...groupItems, ...standalone]
}

async function loadGroupCompaniesData(): Promise<{
  companies: CompanyOption[]
  groups: CompanyGroupRecord[]
}> {
  const { identityCompanyGroups } = await import('@/mocks/data/identity')

  try {
    const result = await fetchCompanies()
    const items = Array.isArray(result.items) ? result.items : []
    return {
      companies: toCompanyOptions(items),
      groups: identityCompanyGroups,
    }
  } catch {
    if (import.meta.env.DEV) {
      const { identityCompanies } = await import('@/mocks/data/identity')
      return {
        companies: toCompanyOptions(identityCompanies),
        groups: identityCompanyGroups,
      }
    }
    return { companies: [], groups: [] }
  }
}

function GroupCompaniesBlock({
  open,
  onOpen,
  onLeave,
}: {
  open: boolean
  onOpen: (anchor: HTMLButtonElement) => void
  onLeave: () => void
}) {
  return (
    <div className={['sidebar__context-group', open ? 'is-open' : ''].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={['sidebar__item', 'sidebar__context-toggle', open ? 'is-open' : ''].filter(Boolean).join(' ')}
        aria-haspopup="true"
        aria-expanded={open}
        data-group-panel="true"
        title={GROUP_COMPANIES_LABEL}
        onMouseEnter={(event) => onOpen(event.currentTarget)}
        onMouseLeave={onLeave}
        onFocus={(event) => onOpen(event.currentTarget)}
        onClick={(event) => onOpen(event.currentTarget)}
      >
        <span className="sidebar__row-main">
          <span className="sidebar__icon">
            <IconBuilding />
          </span>
          <span className="sidebar__label">{GROUP_COMPANIES_LABEL}</span>
        </span>
        <span className="sidebar__expander" aria-hidden>
          <IconChevron />
        </span>
      </button>
    </div>
  )
}

function GroupCompaniesPanel({
  items,
  highlightedLevel2Id,
  top,
  onHoverItem,
  onSelectItem,
  onMouseEnter,
  onMouseLeave,
}: {
  items: Level2Item[]
  highlightedLevel2Id: string | null
  top: number
  onHoverItem: (item: Level2Item) => void
  onSelectItem: (item: Level2Item) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <aside
      className="sidebar-flyout sidebar-flyout--groups"
      aria-label={GROUP_COMPANIES_LABEL}
      style={{ top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="sidebar-flyout__inner">
        <section className="sidebar-flyout__section">
          <header className="sidebar-flyout__section-head">
            <IconBuilding />
            <span>{GROUP_COMPANIES_LABEL}</span>
          </header>
          <ul className="sidebar-flyout__list">
            {items.length === 0 ? (
              <li>
                <span className="sidebar__context-empty">No groups or companies</span>
              </li>
            ) : (
              items.map((item) => {
                const highlighted = item.id === highlightedLevel2Id
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      className={[
                        'sidebar-flyout__link',
                        'sidebar-flyout__link--button',
                        highlighted ? 'sidebar-flyout__link--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => onHoverItem(item)}
                      onFocus={() => onHoverItem(item)}
                      onClick={() => onSelectItem(item)}
                    >
                      <span className="sidebar-flyout__link-label">{item.label}</span>
                      {item.kind === 'group' ? (
                        <span className="sidebar-flyout__link-expander" aria-hidden>
                          <IconChevron />
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </section>
      </div>
    </aside>
  )
}

function SectionModulesFlyout({
  section,
  top,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
}: {
  section: SidebarSection
  top: number
  onMouseEnter: () => void
  onMouseLeave: () => void
  onNavigate: () => void
}) {
  const location = useLocation()
  const SectionIcon = getSectionIcon(section.id)
  const activeModuleId = findModuleByPath(location.pathname)?.module.id ?? null

  return (
    <aside
      className="sidebar-flyout sidebar-flyout--modules"
      aria-label={section.label}
      style={{ top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="sidebar-flyout__inner">
        <section className="sidebar-flyout__section">
          <header className="sidebar-flyout__section-head">
            <SectionIcon />
            <span>{section.label}</span>
          </header>
          <ul className="sidebar-flyout__list">
            {section.children.map((node) => {
              if (node.kind === 'link') {
                return (
                  <li key={node.id}>
                    <NavLink to={node.path} className="sidebar-flyout__link" onClick={onNavigate}>
                      <span className="sidebar-flyout__link-label">{node.label}</span>
                    </NavLink>
                  </li>
                )
              }

              const ModuleIcon = getModuleIcon(node.label)
              const target = node.children.find(
                (child): child is SidebarLink => child.kind === 'link',
              )

              if (!target) {
                return (
                  <li key={node.id}>
                    <span className="sidebar-flyout__link sidebar-flyout__link--static">
                      <span className="sidebar-flyout__link-icon">
                        <ModuleIcon />
                      </span>
                      <span className="sidebar-flyout__link-label">{node.label}</span>
                    </span>
                  </li>
                )
              }

              return (
                <li key={node.id}>
                  <NavLink
                    to={target.path}
                    className={[
                      'sidebar-flyout__link',
                      activeModuleId === node.id ? 'sidebar-flyout__link--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={onNavigate}
                  >
                    <span className="sidebar-flyout__link-icon">
                      <ModuleIcon />
                    </span>
                    <span className="sidebar-flyout__link-label">{node.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </aside>
  )
}

function collectGroupIds(nodes: SidebarNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.kind === 'group') {
      ids.push(node.id, ...collectGroupIds(node.children))
    }
  }
  return ids
}

/** `'customer-revenue.crm'` -> `['customer-revenue', 'customer-revenue.crm']` */
function branchIds(id: string): string[] {
  const segments = id.split('.')
  return segments.map((_, index) => segments.slice(0, index + 1).join('.'))
}

function SidebarNodeList({
  nodes,
  depth,
  openIds,
  onToggle,
  collapsed,
}: {
  nodes: SidebarNode[]
  depth: number
  openIds: Set<string>
  onToggle: (id: string) => void
  collapsed: boolean
}) {
  return (
    <ul className={`sidebar__list sidebar__list--depth-${Math.min(depth, 2)}`}>
      {nodes.map((node) => {
        if (node.kind === 'link') {
          const LinkIcon = getLinkIcon()
          return (
            <li key={node.id}>
              <NavLink
                to={node.path}
                title={node.label}
                className={({ isActive }) =>
                  ['sidebar__link', isActive ? 'sidebar__link--active' : ''].filter(Boolean).join(' ')
                }
              >
                {depth === 1 ? (
                  <span className="sidebar__icon">
                    <LinkIcon />
                  </span>
                ) : null}
                <span className="sidebar__label">{node.label}</span>
              </NavLink>
            </li>
          )
        }

        const isOpen = openIds.has(node.id) && !collapsed
        const ModuleIcon = getModuleIcon(node.label)
        return (
          <li key={node.id} className={['sidebar__group', isOpen ? 'is-open' : ''].filter(Boolean).join(' ')}>
            <button
              type="button"
              className={['sidebar__item', 'sidebar__group-toggle', isOpen ? 'is-open' : '']
                .filter(Boolean)
                .join(' ')}
              aria-expanded={isOpen}
              title={node.label}
              onClick={() => onToggle(node.id)}
            >
              <span className="sidebar__row-main">
                <span className="sidebar__icon">
                  <ModuleIcon />
                </span>
                <span className="sidebar__label">{node.label}</span>
              </span>
              {!collapsed ? (
                <span className="sidebar__expander" aria-hidden>
                  {isOpen ? <IconMinus /> : <IconPlus />}
                </span>
              ) : null}
            </button>
            {isOpen ? (
              <div className="sidebar__subtree">
                <SidebarNodeList
                  nodes={node.children}
                  depth={depth + 1}
                  openIds={openIds}
                  onToggle={onToggle}
                  collapsed={collapsed}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function SectionBlock({
  section,
  openIds,
  onToggle,
  collapsed,
  flyout,
  hover,
}: {
  section: SidebarSection
  openIds: Set<string>
  onToggle: (id: string) => void
  collapsed: boolean
  flyout?: {
    open: boolean
    onEnter: (anchor: HTMLButtonElement) => void
    onLeave: () => void
    onActivate: (anchor: HTMLButtonElement) => void
  }
  /** Collapsed rail: hovering an icon asks the parent for its name panel/tip. */
  hover?: {
    onEnter: (anchor: HTMLButtonElement) => void
    onLeave: () => void
  }
}) {
  const SectionIcon = getSectionIcon(section.id)
  const sectionOpen = openIds.has(section.id) && !collapsed
  const location = useLocation()

  if (collapsed) {
    return (
      <section className="sidebar__section">
        <button
          type="button"
          className="sidebar__item sidebar__section-icon-only"
          aria-label={section.label}
          onClick={() => onToggle(section.children[0]?.kind === 'group' ? section.children[0].id : section.id)}
          onMouseEnter={(event) => hover?.onEnter(event.currentTarget)}
          onMouseLeave={hover?.onLeave}
          onFocus={(event) => hover?.onEnter(event.currentTarget)}
        >
          <span className="sidebar__icon">
            <SectionIcon />
          </span>
        </button>
      </section>
    )
  }

  // Sections without a heading render their modules directly at level 1.
  if (section.hideLabel) {
    return (
      <section className="sidebar__section">
        <SidebarNodeList
          nodes={section.children}
          depth={1}
          openIds={openIds}
          onToggle={onToggle}
          collapsed={collapsed}
        />
      </section>
    )
  }

  // Sections opting into a right-side panel: the row opens the panel instead
  // of pushing its modules down inside the sidebar.
  if (flyout) {
    // A section with a single module has nothing to choose between: send the row
    // straight there and let the module tab bar handle the sub-pages.
    const onlyModule =
      section.children.length === 1 && section.children[0]?.kind === 'group'
        ? section.children[0]
        : null
    const firstPage = onlyModule
      ? onlyModule.children.find((child): child is SidebarLink => child.kind === 'link') ?? null
      : null

    if (onlyModule && firstPage) {
      const alreadyInside = findModuleByPath(location.pathname)?.module.id === onlyModule.id

      return (
        <section className="sidebar__section">
          <NavLink
            to={alreadyInside ? location.pathname : firstPage.path}
            title={section.label}
            onClick={(event) => {
              // Already there: don't push a duplicate history entry.
              if (alreadyInside) {
                event.preventDefault()
              }
            }}
            className={['sidebar__item', 'sidebar__group-toggle', flyout.open ? 'is-open' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <span className="sidebar__row-main">
              <span className="sidebar__icon">
                <SectionIcon />
              </span>
              <span className="sidebar__label">{section.label}</span>
            </span>
          </NavLink>
        </section>
      )
    }

    return (
      <section className="sidebar__section">
        <button
          type="button"
          className={['sidebar__item', 'sidebar__group-toggle', flyout.open ? 'is-open' : '']
            .filter(Boolean)
            .join(' ')}
          aria-haspopup="true"
          aria-expanded={flyout.open}
          title={section.label}
          data-section-flyout="true"
          onMouseEnter={(event) => flyout.onEnter(event.currentTarget)}
          onMouseLeave={flyout.onLeave}
          onFocus={(event) => flyout.onEnter(event.currentTarget)}
          onClick={(event) => flyout.onActivate(event.currentTarget)}
        >
          <span className="sidebar__row-main">
            <span className="sidebar__icon">
              <SectionIcon />
            </span>
            <span className="sidebar__label">{section.label}</span>
          </span>
          <span className="sidebar__expander" aria-hidden>
            <IconChevron />
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="sidebar__section">
      <button
        type="button"
        className={['sidebar__item', 'sidebar__group-toggle', sectionOpen ? 'is-open' : '']
          .filter(Boolean)
          .join(' ')}
        aria-expanded={sectionOpen}
        title={section.label}
        onClick={() => onToggle(section.id)}
      >
        <span className="sidebar__row-main">
          <span className="sidebar__icon">
            <SectionIcon />
          </span>
          <span className="sidebar__label">{section.label}</span>
        </span>
        <span className="sidebar__expander" aria-hidden>
          {sectionOpen ? <IconMinus /> : <IconPlus />}
        </span>
      </button>
      {sectionOpen ? (
        <div className="sidebar__subtree">
          <SidebarNodeList
            nodes={section.children}
            depth={2}
            openIds={openIds}
            onToggle={onToggle}
            collapsed={collapsed}
          />
        </div>
      ) : null}
    </section>
  )
}

export function Sidebar() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const isHydrated = useAuthStore((state) => state.isHydrated)
  const [query, setQuery] = useState('')
  const companyId = useCompanyStore((state) => state.companyId)
  const companyOptions = useCompanyStore((state) => state.companies)
  const companyGroups = useCompanyStore((state) => state.groups)
  const setCompanyData = useCompanyStore((state) => state.setData)
  const setActiveCompany = useCompanyStore((state) => state.setCompany)
  const setPreviewCompany = useCompanyStore((state) => state.setPreviewCompany)
  const [collapsed, setCollapsed] = useState(() => {
    return window.sessionStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  })
  const [companiesPanelOpen, setCompaniesPanelOpen] = useState(false)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
  const [flyoutSectionId, setFlyoutSectionId] = useState<string | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState({ top: 0, center: 0 })
  const [iconTipLabel, setIconTipLabel] = useState<string | null>(null)
  const hideFlyoutTimerRef = useRef<number | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const sections = useMemo(() => filterSidebarSections(query), [query])
  const level2Items = useMemo(
    () => buildLevel2Items(companyOptions, companyGroups),
    [companyOptions, companyGroups],
  )
  const initials = (user?.name || user?.email || 'A')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    if (query.trim()) {
      setOpenIds(
        new Set(sections.flatMap((section) => [section.id, ...collectGroupIds(section.children)])),
      )
      return
    }
    const ancestors = collectAncestorGroupIds(location.pathname)
    setOpenIds(new Set(ancestors))
  }, [location.pathname, query, sections])

  useEffect(() => {
    window.sessionStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
    if (collapsed) {
      setHoveredGroupId(null)
      setCompaniesPanelOpen(false)
      setPreviewCompany(null)
    }
  }, [collapsed, setPreviewCompany])

  useEffect(() => {
    return () => {
      if (hideFlyoutTimerRef.current !== null) {
        window.clearTimeout(hideFlyoutTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (flyoutSectionId === null && iconTipLabel === null && !companiesPanelOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      if (
        target.closest('.sidebar-flyout--modules') ||
        target.closest('.sidebar-flyout--groups') ||
        target.closest('[data-section-flyout="true"]') ||
        target.closest('[data-group-panel="true"]')
      ) {
        return
      }
      closePopovers()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePopovers()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [flyoutSectionId, iconTipLabel, companiesPanelOpen])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    let cancelled = false
    void loadGroupCompaniesData().then(({ companies, groups }) => {
      if (cancelled) {
        return
      }
      setCompanyData(companies, groups)
    })
    return () => {
      cancelled = true
    }
  }, [isHydrated, setCompanyData])

  async function handleLogout() {
    await logout()
  }

  function handleToggle(id: string) {
    if (collapsed) {
      setCollapsed(false)
      setOpenIds(new Set(branchIds(id)))
      return
    }

    setOpenIds((current) => {
      if (current.has(id) && !query.trim()) {
        // Collapsing keeps the owning section open.
        const segments = id.split('.')
        return new Set(segments.length > 1 ? [segments[0]] : [])
      }
      return new Set(branchIds(id))
    })
  }

  function persistCompany(nextCompanyId: string) {
    setActiveCompany(nextCompanyId)
  }

  function cancelHideFlyout() {
    if (hideFlyoutTimerRef.current !== null) {
      window.clearTimeout(hideFlyoutTimerRef.current)
      hideFlyoutTimerRef.current = null
    }
  }

  function scheduleHideFlyout() {
    cancelHideFlyout()
    hideFlyoutTimerRef.current = window.setTimeout(() => {
      setHoveredGroupId(null)
      setFlyoutSectionId(null)
      setIconTipLabel(null)
      setCompaniesPanelOpen(false)
      setPreviewCompany(null)
      hideFlyoutTimerRef.current = null
    }, POPOVER_HIDE_DELAY_MS)
  }

  function closePopovers() {
    setHoveredGroupId(null)
    setFlyoutSectionId(null)
    setIconTipLabel(null)
    setCompaniesPanelOpen(false)
    setPreviewCompany(null)
  }

  function measureAnchor(anchor: HTMLElement) {
    const shell = shellRef.current
    if (!shell) {
      return
    }
    const shellRect = shell.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    setPopoverAnchor({
      top: Math.max(0, anchorRect.top - shellRect.top),
      center: Math.max(0, anchorRect.top - shellRect.top + anchorRect.height / 2),
    })
  }

  /**
   * Level-1 panel. A group has no page of its own: hovering it previews its
   * companies in the top company tabs, clicking it moves the active company
   * into that group.
   */
  function handleHoverCompaniesItem(item: Level2Item) {
    cancelHideFlyout()

    if (item.kind === 'company') {
      // Previewing a company previews *its* group - empty for standalone ones,
      // so the strip never keeps showing the previously previewed group.
      setHoveredGroupId(null)
      setPreviewCompany(item.id)
      return
    }

    setFlyoutSectionId(null)
    setIconTipLabel(null)
    setHoveredGroupId(item.id)
    setPreviewCompany(item.companies[0]?.value ?? null)
  }

  function handleOpenCompaniesPanel(anchor: HTMLButtonElement) {
    cancelHideFlyout()
    setHoveredGroupId(null)
    setFlyoutSectionId(null)
    setIconTipLabel(null)
    measureAnchor(anchor)
    setCompaniesPanelOpen(true)
  }

  function handleOpenSectionFlyout(section: SidebarSection, anchor: HTMLButtonElement) {
    cancelHideFlyout()
    setHoveredGroupId(null)
    setIconTipLabel(null)
    setPreviewCompany(null)
    setCompaniesPanelOpen(false)
    measureAnchor(anchor)
    setFlyoutSectionId(section.id)
  }

  /** Collapsed rail: sections with modules show the panel, the rest a name tip. */
  function handleHoverRailIcon(section: SidebarSection, anchor: HTMLButtonElement) {
    if (collapsed && !hasModuleChoice(section)) {
      cancelHideFlyout()
      setHoveredGroupId(null)
      setFlyoutSectionId(null)
      setCompaniesPanelOpen(false)
      measureAnchor(anchor)
      setIconTipLabel(section.label)
      return
    }
    handleOpenSectionFlyout(section, anchor)
  }

  /**
   * A group has no page of its own: clicking it moves the active company into
   * that group, which makes its companies the tabs in the top bar.
   */
  function handleSelectLevel2(item: Level2Item) {
    if (item.kind === 'group') {
      const firstMemberId = item.companies[0]?.value
      if (firstMemberId) {
        persistCompany(firstMemberId)
      }
      closePopovers()
      return
    }

    persistCompany(item.id)
    closePopovers()
  }

  const activeCompany = companyOptions.find((item) => item.value === companyId) ?? null

  const highlightedLevel2Id =
    hoveredGroupId ??
    level2Items.find((item) => item.kind === 'company' && item.id === companyId)?.id ??
    null

  const flyoutSection = flyoutSectionId
    ? sections.find((section) => section.id === flyoutSectionId) ?? null
    : null

  return (
    <div
      ref={shellRef}
      className={['sidebar-shell', collapsed ? 'sidebar-shell--collapsed' : ''].filter(Boolean).join(' ')}
    >
      <aside
        className={['sidebar', collapsed ? 'sidebar--collapsed' : ''].filter(Boolean).join(' ')}
        aria-label="Primary"
        data-collapsed={collapsed ? 'true' : 'false'}
        data-company-id={companyId || undefined}
      >
      <div className="sidebar__brand-row">
        <div className="sidebar__brand" title="AIOS NOVA">
          <BrandLogo />
        </div>
        <button
          type="button"
          className="sidebar__collapse-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((value) => !value)}
        >
          <IconChevron />
        </button>
      </div>

      <div className="sidebar__search">
        <span className="sidebar__search-icon" aria-hidden>
          <IconSearch />
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search..."
          aria-label="Search navigation"
        />
      </div>

      {!collapsed && activeCompany ? (
        <div className="sidebar__company-context" title={activeCompany.label}>
          <span className="sidebar__company-context-label">Active company</span>
          <strong className="sidebar__company-context-name">{activeCompany.label}</strong>
        </div>
      ) : null}

      {!collapsed ? (
        <div className="sidebar__context">
          <GroupCompaniesBlock
            open={companiesPanelOpen}
            onOpen={handleOpenCompaniesPanel}
            onLeave={scheduleHideFlyout}
          />
        </div>
      ) : null}

      {collapsed ? (
        <div className="sidebar__rail-context">
          <button
            type="button"
            className="sidebar__item sidebar__section-icon-only"
            aria-label={GROUP_COMPANIES_LABEL}
            aria-haspopup="true"
            aria-expanded={companiesPanelOpen}
            data-group-panel="true"
            onMouseEnter={(event) => handleOpenCompaniesPanel(event.currentTarget)}
            onMouseLeave={scheduleHideFlyout}
            onFocus={(event) => handleOpenCompaniesPanel(event.currentTarget)}
            onClick={() => setCollapsed(false)}
          >
            <span className="sidebar__icon">
              <IconBuilding />
            </span>
          </button>
        </div>
      ) : null}

      <nav className="sidebar__nav">
        {sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            openIds={openIds}
            onToggle={handleToggle}
            collapsed={collapsed}
            flyout={
              INLINE_SECTION_IDS.has(section.id)
                ? undefined
                : {
                    open: flyoutSectionId === section.id || openIds.has(section.id),
                    onEnter: (anchor) => handleOpenSectionFlyout(section, anchor),
                    onLeave: scheduleHideFlyout,
                    onActivate: (anchor) => handleOpenSectionFlyout(section, anchor),
                  }
            }
            hover={{
              onEnter: (anchor) => handleHoverRailIcon(section, anchor),
              onLeave: scheduleHideFlyout,
            }}
          />
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__avatar" aria-hidden>
          {initials}
        </div>
        <div className="sidebar__user">
          <strong>{user?.name ?? 'User'}</strong>
          <span>{user?.email ?? ''}</span>
        </div>
        <button
          type="button"
          className="sidebar__logout"
          aria-label="Log out"
          title="Log out"
          onClick={() => void handleLogout()}
        >
          <IconLogout />
        </button>
      </div>
      </aside>

      {companiesPanelOpen ? (
        <GroupCompaniesPanel
          items={level2Items}
          highlightedLevel2Id={highlightedLevel2Id}
          top={popoverAnchor.top}
          onHoverItem={handleHoverCompaniesItem}
          onSelectItem={handleSelectLevel2}
          onMouseEnter={cancelHideFlyout}
          onMouseLeave={scheduleHideFlyout}
        />
      ) : null}

      {flyoutSection ? (
        <SectionModulesFlyout
          section={flyoutSection}
          top={popoverAnchor.top}
          onMouseEnter={cancelHideFlyout}
          onMouseLeave={scheduleHideFlyout}
          onNavigate={closePopovers}
        />
      ) : null}

      {iconTipLabel ? (
        <div className="sidebar-tip" role="tooltip" style={{ top: popoverAnchor.center }}>
          {iconTipLabel}
        </div>
      ) : null}
    </div>
  )
}

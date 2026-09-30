import { useMemo } from 'react'
import { findCompanyGroup, useCompanyStore } from '@/stores/companyStore'
import './TopTabs.css'

/**
 * Company switcher for the top bar. Shows the companies of the group that owns
 * the active company (or the group being previewed from the sidebar), and
 * switches the active company when a tab is picked. Rendered with the exact
 * same tab styling as ModuleTabs.
 */
export function CompanyTabs() {
  const companies = useCompanyStore((state) => state.companies)
  const groups = useCompanyStore((state) => state.groups)
  const companyId = useCompanyStore((state) => state.companyId)
  const previewGroupId = useCompanyStore((state) => state.previewGroupId)
  const setCompany = useCompanyStore((state) => state.setCompany)

  const group = useMemo(() => {
    if (previewGroupId) {
      return groups.find((item) => item.id === previewGroupId) ?? null
    }
    return findCompanyGroup(groups, companyId)
  }, [groups, companyId, previewGroupId])

  const members = useMemo(() => {
    if (!group) {
      return []
    }
    const byId = new Map(companies.map((item) => [item.value, item]))
    return group.companyIds
      .map((id) => byId.get(id))
      .filter((item): item is { value: string; label: string } => Boolean(item))
  }, [group, companies])

  if (!group || members.length < 2) {
    return null
  }

  return (
    <nav className="top-tabs" aria-label={group.name}>
      <div className="top-tabs__inner">
        {members.map((company) => {
          const active = company.value === companyId
          return (
            <button
              key={company.value}
              type="button"
              className={['top-tabs__tab', active ? 'top-tabs__tab--active' : ''].filter(Boolean).join(' ')}
              aria-current={active ? 'true' : undefined}
              onClick={() => setCompany(company.value)}
            >
              {company.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

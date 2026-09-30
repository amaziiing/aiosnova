import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { findModuleByPath } from '@/navigation/sidebarNav'
import './TopTabs.css'

/**
 * Secondary navigation for the module the current route belongs to.
 * Renders a full-width tab strip directly under the app header.
 */
export function ModuleTabs() {
  const location = useLocation()
  const match = useMemo(() => findModuleByPath(location.pathname), [location.pathname])

  if (!match) {
    return null
  }

  return (
    <nav className="top-tabs" aria-label={`${match.module.label} sections`}>
      <div className="top-tabs__inner">
        {match.items.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              ['top-tabs__tab', isActive ? 'top-tabs__tab--active' : ''].filter(Boolean).join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

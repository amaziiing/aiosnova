import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { findModuleByPath } from '@/navigation/sidebarNav'
import './ModuleTabs.css'

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
    <nav className="module-tabs" aria-label={`${match.module.label} sections`}>
      <div className="module-tabs__inner">
        {match.items.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              ['module-tabs__tab', isActive ? 'module-tabs__tab--active' : ''].filter(Boolean).join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export type NavItem = {
  to: string
  label: string
  shortLabel?: string
}

export const primaryNav: NavItem[] = [
  { to: '/home', label: 'Home' },
  { to: '/sell', label: 'Sales' },
  { to: '/crushing', label: 'Crushing' },
  { to: '/stock', label: 'Stock' },
  { to: '/more', label: 'More' },
]

export const moreNav: NavItem[] = [
  { to: '/buy', label: 'Purchase', shortLabel: 'Buy raw material' },
  { to: '/crushing', label: 'Crushing', shortLabel: 'Customer crushing service' },
  { to: '/expense', label: 'Expenses' },
  { to: '/bills', label: 'Bills' },
  { to: '/customers', label: 'Customers' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

export const sidebarNav: NavItem[] = [
  ...primaryNav.filter((item) => item.to !== '/more'),
  ...moreNav,
]

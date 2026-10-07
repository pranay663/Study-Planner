import { useState } from 'react'
import { BookOpen, CalendarDays, ChartNoAxesColumnIncreasing, CheckSquare2, CirclePlus, LayoutDashboard, Menu, Sparkles, X } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '#overview', icon: LayoutDashboard, page: 'dashboard' },
  { label: 'Study calendar', href: '#calendar', icon: CalendarDays, page: 'calendar' },
  { label: 'AI assistant', href: '#assistant', icon: Sparkles, page: 'assistant' },
  { label: "Today's tasks", href: '#tasks', icon: CheckSquare2, page: 'dashboard', anchor: 'tasks' },
  { label: 'Progress', href: '#progress', icon: ChartNoAxesColumnIncreasing, page: 'dashboard', anchor: 'progress' },
]

export function Navbar({ activePage, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function handleNavigation(event, item) {
    event.preventDefault()
    onNavigate(item.page, item.anchor)
    setMenuOpen(false)
  }

  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Studywise home" onClick={(event) => handleNavigation(event, { page: 'dashboard' })}>
          <span className="brand-mark"><BookOpen size={19} strokeWidth={2.3} /></span>
          <span>studywise<span className="brand-period">.</span></span>
        </a>
        <div className="nav-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ label, href, icon: Icon, page, anchor }) => (
            <a className={`nav-link${activePage === page && (page === 'calendar' || !anchor) ? ' is-active' : ''}`} href={href} key={label} onClick={(event) => handleNavigation(event, { page, anchor })}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {label === "Today's tasks" && <span className="nav-count">3</span>}
            </a>
          ))}
        </nav>
        <a className="sidebar-add" href="#add-subject" onClick={(event) => handleNavigation(event, { page: 'dashboard', anchor: 'add-subject' })}><CirclePlus size={17} /> Add a subject</a>
        <div className="sidebar-bottom">
          <div className="streak-card">
            <span className="streak-spark">✳</span>
            <div><strong>4 day streak</strong><span>You're on a roll!</span></div>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">JD</div>
            <div className="profile-copy"><strong>Jamie Davis</strong><span>Student</span></div>
            <span className="profile-menu" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <header className="mobile-header">
        <a className="brand" href="#overview" aria-label="Studywise home" onClick={(event) => handleNavigation(event, { page: 'dashboard' })}>
          <span className="brand-mark"><BookOpen size={19} strokeWidth={2.3} /></span>
          <span>studywise<span className="brand-period">.</span></span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {menuOpen && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
              {navItems.map(({ label, href, icon: Icon, page, anchor }) => (
                <a href={href} key={label} onClick={(event) => handleNavigation(event, { page, anchor })}><Icon size={18} /><span>{label}</span></a>
            ))}
            <a href="#add-subject" onClick={(event) => handleNavigation(event, { page: 'dashboard', anchor: 'add-subject' })}><CirclePlus size={18} /><span>Add a subject</span></a>
          </nav>
        )}
      </header>
    </>
  )
}
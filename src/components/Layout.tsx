import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, LayoutDashboard, FileText, Clock, Trophy, MessageCircle, LogOut, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import styles from '@/styles/components/Sidebar.module.css';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const studentNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/assignments', icon: FileText, label: 'Assignments' },
    { to: '/doubts', icon: HelpCircle, label: 'My Questions' },
    { to: '/study-timer', icon: Clock, label: 'Study Timer' },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  ];

  const teacherNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/assignments', icon: FileText, label: 'Assignments' },
    { to: '/doubts', icon: MessageCircle, label: 'Student Doubts' },
  ];

  const navItems = role === 'teacher' ? teacherNav : studentNav;
  const initials = user?.user_metadata?.full_name?.split(' ').map((n: string) => n[0]).join('') || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}><BookOpen size={20} /></div>
            <span className={styles.logoText}>EduFlow</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>
            <div className={styles.navSectionTitle}>Menu</div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <item.icon className={styles.navIcon} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>{initials}</div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{user?.user_metadata?.full_name || user?.email}</div>
              <div className={styles.userRole}>{role}</div>
            </div>
          </div>
          <button className={styles.navItem} onClick={handleSignOut} style={{ marginTop: '8px', width: '100%' }}>
            <LogOut className={styles.navIcon} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.pageTitle}>{title}</h1>
        </header>
        <motion.div 
          className={styles.contentWrapper}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

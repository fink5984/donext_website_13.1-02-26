import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './login.module.scss';
import Dashboard from "@/app/icons/dashboard.svg";
import ContactsIcon from "@/app/icons/contacts.svg";
import CashFlowIcon from "@/app/icons/cashFlow.svg";
import SettingsIcon from "@/app/icons/settings.svg";
import IconTooltip from '@/app/[locale]/components/IconTooltip/IconTooltip';

export function CampaignSelectionSidebar({ onLogout, activeSection, onSectionChange, isAdmin = false, isAdminOrManager = false }) {
  const params = useParams();
  const locale = params?.locale || 'he';
  const t = useTranslations('campaignSelectionSidebar');
  const isRTL = locale === 'he';
  
  // Use parent-controlled state if provided, otherwise local state
  const [localActiveMenu, setLocalActiveMenu] = useState('campaigns');
  const activeMenu = activeSection || localActiveMenu;

  // Build nav items - contacts only visible to admin
  const navItems = [
    {
      id: 'campaigns',
      icon: <Dashboard />,
      title: t('campaigns'),
      menu: [
        { label: t('newCampaign'), href: `/${locale}/new` }
      ]
    },
    // Only show contacts for admin/manager users
    ...(isAdminOrManager ? [{
      id: 'contacts',
      icon: <ContactsIcon />,
      title: t('contacts'),
      href: `/${locale}/contacts`,
      menu: []
    }] : []),
    // Cash flow page — admin/manager only
    ...(isAdminOrManager ? [{
      id: 'cashFlow',
      icon: <CashFlowIcon />,
      title: t('cashFlow'),
      href: `/${locale}/cash-flow`,
      menu: []
    }] : []),
    // Only show settings for admin/manager users
    ...(isAdminOrManager ? [{
      id: 'settings',
      icon: <SettingsIcon />,
      title: t('settings'),
      menu: [
        { label: t('addTags'), href: `/${locale}/tags` }
      ]
    }] : [])
  ];

  const handleIconClick = (itemId) => {
    const navItem = navItems.find(item => item.id === itemId);
    if (navItem?.href) {
      window.location.href = navItem.href;
      return;
    }
    if (onSectionChange) {
      onSectionChange(itemId);
    } else {
      setLocalActiveMenu(itemId);
    }
  };

  const activeMenuItem = navItems.find(item => item.id === activeMenu);

  return (
    <div className={`${styles.selectionNavWrapper} ${isRTL ? styles.rtl : ''}`}>
      <nav className={styles.selectionSidebar}>
        <div className={styles.selectionSection}>
          {navItems.map((item) => (
            <div key={item.id} className={styles.selectionNavItemWrapper}>
              <div
                className={`${styles.selectionNavItem} ${activeMenu === item.id ? styles.active : ''}`}
                onClick={() => handleIconClick(item.id)}
              >
                <IconTooltip icon={item.icon} text={item.title} />
              </div>
            </div>
          ))}
        </div>
      </nav>

      {activeMenuItem && (
        <div className={styles.selectionMenuSidebar}>
          {onLogout && (
            <button
              onClick={onLogout}
              className={styles.logoutButton}
            >
              {t('logout')}
            </button>
          )}
          <div className={styles.selectionMenu}>
            {activeMenuItem.menu.map((menuItem, menuIndex) => (
              menuItem.disabled ? (
                <span
                  key={menuIndex}
                  className={`${styles.selectionMenuItem} ${styles.disabled} table-2`}
                  title={t('comingSoon')}
                >
                  {menuItem.label}
                </span>
              ) : menuItem.action ? (
                <button
                  key={menuIndex}
                  className={`${styles.selectionMenuItem} ${styles.clickable} table-2`}
                  onClick={() => onSectionChange && onSectionChange(menuItem.action)}
                >
                  {menuItem.label}
                </button>
              ) : (
                <Link
                  key={menuIndex}
                  href={menuItem.href}
                  className={`${styles.selectionMenuItem} table-2`}
                >
                  {menuItem.label}
                </Link>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

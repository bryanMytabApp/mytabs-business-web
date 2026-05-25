import { useSettings } from '../context/SettingsContext';

export const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'PersonOutlined', roles: null, requiresOrg: false },
  { id: 'account', label: 'Account', icon: 'LockOutlined', roles: null, requiresOrg: false },
  { id: 'security', label: 'Security', icon: 'ShieldOutlined', roles: null, requiresOrg: false },
  { id: 'organization', label: 'Organization', icon: 'BusinessOutlined', roles: null, requiresOrg: false },
  { id: 'team', label: 'Team', icon: 'GroupOutlined', roles: null, requiresOrg: false },
  { id: 'billing', label: 'Billing', icon: 'CreditCardOutlined', roles: null, requiresOrg: false },
  { id: 'privacy', label: 'Privacy', icon: 'VisibilityOffOutlined', roles: null, requiresOrg: false },
];

export const filterSections = (sections, userRole, orgId) => {
  return sections.filter((section) => {
    // Org-required sections hidden if user has no org
    if (section.requiresOrg && !orgId) return false;

    // Role-gated sections hidden if user role doesn't match
    if (section.roles && !section.roles.includes(userRole)) return false;

    return true;
  });
};

const useSettingsVisibility = () => {
  const { state } = useSettings();
  const { userRole, organizationId } = state;

  const visibleSections = filterSections(SETTINGS_SECTIONS, userRole, organizationId);

  return { visibleSections, userRole, orgId: organizationId };
};

export default useSettingsVisibility;

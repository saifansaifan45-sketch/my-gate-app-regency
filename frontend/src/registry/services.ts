

export type ServiceEntry = {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: any;
  category: string;
  availableRoles: string[];
  isEmergency?: boolean;
  requiresAuth?: boolean;
};

export const QUICK_ACTION_VISUALS = {
  standard: {
    background: '#F0EBE3',
    icon: '#8B6F47',
  },
  emergency: {
    background: '#FEE2E2',
    icon: '#DC2626',
  },
} as const;

export const SERVICE_CATALOG: ServiceEntry[] = [
  { id: 'sos', label: 'SOS Alert', description: 'Emergency response', icon: 'alert-circle', route: '/home', category: 'Safety', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], isEmergency: true, requiresAuth: true },
  { id: 'add-visitor', label: 'Add Visitor', description: 'Pre-approve entry', icon: 'user-plus', route: '/visitors', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'cab-alert', label: 'Cab Alert', description: 'Expected cab', icon: 'navigation', route: '/visitors', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'delivery', label: 'Delivery', description: 'Expected package', icon: 'package', route: '/visitors', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'house-help', label: 'House Help', description: 'Maids & cooks', icon: 'users', route: '/visitors', category: 'Home Services', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'help-desk', label: 'Help Desk', description: 'Raise a ticket', icon: 'headphones', route: '/help-desk', category: 'Support', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'maintenance', label: 'Maintenance', description: 'Request repairs', icon: 'tool', route: '/services/maintenance', category: 'Home Services', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  // Disabled: no /lost-found backend route exists yet.
  // { id: 'lost-found', label: 'Lost & Found', description: 'Report items', icon: 'search', route: '/community', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP'], requiresAuth: true },
  { id: 'activity-log', label: 'Activity Log', description: 'My gate history', icon: 'list', route: '/activity-log', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'announcements', label: 'Notice', description: 'Notices & updates', icon: 'bell', route: '/announcements', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], requiresAuth: true },
  { id: 'family', label: 'Family', description: 'Manage access', icon: 'home', route: '/family-members', category: 'Support', availableRoles: ['OWNER', 'TENANT'], requiresAuth: true },
  { id: 'community-hub', label: 'Community', description: 'Rules & docs', icon: 'grid', route: '/community-hub', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], requiresAuth: true },
  // Disabled: Calendar currently uses local seeded state and has no backend event API.
  // { id: 'calendar', label: 'Calendar', description: 'Events & bookings', icon: 'calendar', route: '/calendar', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP'], requiresAuth: true },
];



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

export const SERVICE_CATALOG: ServiceEntry[] = [
  { id: 'sos', label: 'SOS Alert', description: 'Emergency response', icon: 'alert-circle', route: '/home?sos=1', category: 'Safety', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], isEmergency: true, requiresAuth: true },
  { id: 'add-visitor', label: 'Add Visitor', description: 'Pre-approve entry', icon: 'user-plus', route: '/visitors/add?type=GUEST', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'cab-alert', label: 'Cab Alert', description: 'Expected cab', icon: 'navigation', route: '/visitors/add?type=CAB', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'delivery', label: 'Delivery', description: 'Expected package', icon: 'package', route: '/visitors/add?type=DELIVERY', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'house-help', label: 'House Help', description: 'Maids & cooks', icon: 'users', route: '/house-help', category: 'Home Services', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'help-desk', label: 'Help Desk', description: 'Raise a ticket', icon: 'headphones', route: '/tickets/create', category: 'Support', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'maintenance', label: 'Maintenance', description: 'Request repairs', icon: 'tool', route: '/tickets/create?category=MAINTENANCE', category: 'Home Services', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'lost-found', label: 'Lost & Found', description: 'Report items', icon: 'search', route: '/community/lost-found', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP'], requiresAuth: true },
  { id: 'activity-log', label: 'Activity Log', description: 'My gate history', icon: 'list', route: '/visitors/activity', category: 'Gate & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT'], requiresAuth: true },
  { id: 'announcements', label: 'Announcements', description: 'Notices & updates', icon: 'bell', route: '/community/announcements', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], requiresAuth: true },
  { id: 'family', label: 'Family Members', description: 'Manage access', icon: 'home', route: '/profile/family', category: 'Support', availableRoles: ['OWNER', 'TENANT'], requiresAuth: true },
  { id: 'community-hub', label: 'Community Hub', description: 'Rules & docs', icon: 'grid', route: '/community/hub', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], requiresAuth: true },
  { id: 'calendar', label: 'Calendar', description: 'Events & bookings', icon: 'calendar', route: '/community/calendar', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP'], requiresAuth: true },
];

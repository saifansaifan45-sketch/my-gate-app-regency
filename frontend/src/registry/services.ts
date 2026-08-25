

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
    background: '#E9F4EA',
    icon: '#1B4D36',
  },
  emergency: {
    background: '#FDECEA',
    icon: '#B42318',
  },
} as const;

export const SERVICE_CATALOG: ServiceEntry[] = [
  { id: 'sos', label: 'SOS Alert', description: 'Emergency response', icon: 'alert-circle', route: '/home', category: 'Safety', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], isEmergency: true, requiresAuth: true },
  { id: 'add-visitor', label: 'Invite Guest', description: 'Pre-approve entry', icon: 'user-plus', route: '/visitors', category: 'Entry & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'LEADERSHIP'], requiresAuth: true },
  { id: 'cab-alert', label: 'Cab Arrival', description: 'Notify the gate', icon: 'navigation', route: '/visitors', category: 'Entry & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'LEADERSHIP'], requiresAuth: true },
  { id: 'delivery', label: 'Delivery Arrival', description: 'Notify the gate', icon: 'package', route: '/visitors', category: 'Entry & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'LEADERSHIP'], requiresAuth: true },
  { id: 'house-help', label: 'Household Help', description: 'Manage home staff', icon: 'users', route: '/visitors', category: 'Home Care', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'LEADERSHIP'], requiresAuth: true },
  { id: 'help-desk', label: 'Support', description: 'Get help from management', icon: 'headphones', route: '/help-desk', category: 'Support', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'LEADERSHIP'], requiresAuth: true },
  { id: 'maintenance', label: 'Repairs', description: 'Report a maintenance issue', icon: 'tool', route: '/services/maintenance', category: 'Home Care', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'LEADERSHIP'], requiresAuth: true },
  // Disabled: no /lost-found backend route exists yet.
  // { id: 'lost-found', label: 'Lost & Found', description: 'Report items', icon: 'search', route: '/community', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP'], requiresAuth: true },
  { id: 'activity-log', label: 'Entry History', description: 'Review gate activity', icon: 'list', route: '/activity-log', category: 'Entry & Visitors', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'LEADERSHIP'], requiresAuth: true },
  { id: 'announcements', label: 'Notices', description: 'Community updates', icon: 'bell', route: '/announcements', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], requiresAuth: true },
  { id: 'family', label: 'Family Access', description: 'Manage household access', icon: 'home', route: '/family-members', category: 'Support', availableRoles: ['OWNER', 'TENANT', 'LEADERSHIP'], requiresAuth: true },
  { id: 'community-hub', label: 'Community Hub', description: 'Rules, documents & spaces', icon: 'grid', route: '/community-hub', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP', 'WORKFORCE'], requiresAuth: true },
  // Disabled: Calendar currently uses local seeded state and has no backend event API.
  // { id: 'calendar', label: 'Calendar', description: 'Events & bookings', icon: 'calendar', route: '/calendar', category: 'Community', availableRoles: ['OWNER', 'TENANT', 'RESIDENT', 'MANAGER', 'LEADERSHIP'], requiresAuth: true },
];

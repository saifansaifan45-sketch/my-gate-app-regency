export interface PersonnelRoleSource {
  category?: string | null;
  department?: string | null;
}

/**
 * Converts the personnel category into the label shown to a workforce user.
 * Category is intentionally preferred over department: a security worker can
 * belong to a general operations department without becoming Maintenance.
 */
export function getPersonnelRoleLabel(personnel?: PersonnelRoleSource | null): string {
  const category = personnel?.category?.toUpperCase();
  const department = personnel?.department?.toUpperCase();

  switch (category || department) {
    case 'SECURITY':
      return 'Security';
    case 'CLEANER':
      return 'Housekeeping';
    case 'ELECTRICIAN':
      return 'Electrical';
    case 'PLUMBER':
      return 'Plumbing';
    case 'GARDENER':
      return 'Gardening';
    case 'MAINTENANCE':
      return 'Maintenance';
    default:
      return personnel?.department || 'Operations';
  }
}

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

function normalizeWorkCategory(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

/** Keep the assignment picker aligned with the server-side trade guard. */
export function isPersonnelCompatibleWithTicket(personnelCategory: string, ticketCategory: string): boolean {
  const personnel = normalizeWorkCategory(personnelCategory);
  const ticket = normalizeWorkCategory(ticketCategory);
  const isSecurityTicket = ['SECURITY', 'GATE', 'VISITOR', 'ACCESS', 'EMERGENCY'].some((term) => ticket.includes(term));

  if (personnel === 'SECURITY') return isSecurityTicket;
  if (isSecurityTicket) return personnel === 'SECURITY';
  if (ticket.includes('PLUMB')) return personnel === 'PLUMBER';
  if (ticket.includes('ELECTRIC')) return personnel === 'ELECTRICIAN';
  if (ticket.includes('CLEAN') || ticket.includes('HOUSEKEEP')) return personnel === 'CLEANER';
  if (ticket.includes('GARDEN') || ticket.includes('LANDSCAP')) return personnel === 'GARDENER';
  return ['MAINTENANCE', 'ELECTRICIAN', 'PLUMBER', 'CLEANER', 'GARDENER', 'OTHER'].includes(personnel);
}

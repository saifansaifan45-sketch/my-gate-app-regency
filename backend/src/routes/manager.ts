import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireManager, requireLeadership, requireWorkforceOrManager, AuthRequest } from '../middleware/auth';
import * as XLSX from 'xlsx';
import {
  TicketPriority,
  TicketStatus,
  TaskStatus,
  PersonnelCategory,
  AvailabilityStatus,
  AttendanceStatus,
  Role,
} from '@prisma/client';

const router = Router();

// Apply auth to all manager routes
router.use(requireAuth);

function normalizeWorkCategory(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function isPersonnelCompatibleWithTicket(personnelCategory: PersonnelCategory, ticketCategory: string): boolean {
  const personnel = normalizeWorkCategory(personnelCategory);
  const ticket = normalizeWorkCategory(ticketCategory);
  const isSecurityTicket = ['SECURITY', 'GATE', 'VISITOR', 'ACCESS', 'EMERGENCY'].some((term) => ticket.includes(term));

  // Security personnel are gate/security operators, not maintenance technicians.
  if (personnel === 'SECURITY') return isSecurityTicket;
  if (isSecurityTicket) return personnel === 'SECURITY';

  if (ticket.includes('PLUMB')) return personnel === 'PLUMBER';
  if (ticket.includes('ELECTRIC')) return personnel === 'ELECTRICIAN';
  if (ticket.includes('CLEAN') || ticket.includes('HOUSEKEEP')) return personnel === 'CLEANER';
  if (ticket.includes('GARDEN') || ticket.includes('LANDSCAP')) return personnel === 'GARDENER';

  // General maintenance may be handled by a maintenance worker or an
  // appropriately trained trade worker, but never by Security.
  return ['MAINTENANCE', 'ELECTRICIAN', 'PLUMBER', 'CLEANER', 'GARDENER', 'OTHER'].includes(personnel);
}

// Helper to get start and end of a given date (default today)
function getDateRange(dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end, date };
}

// ----------------------------------------------------
// 1. GET /manager/dashboard
// ----------------------------------------------------
router.get('/dashboard', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const todayRange = getDateRange();

    // 1. Ticket counts
    const [pendingTickets, assignedTasks, inProgressTasks, completedTasks] = await Promise.all([
      prisma.ticket.count({ where: { status: TicketStatus.OPEN } }),
      prisma.task.count({ where: { status: TaskStatus.ASSIGNED } }),
      prisma.task.count({ where: { status: TaskStatus.IN_PROGRESS } }),
      prisma.task.count({ where: { status: { in: [TaskStatus.COMPLETED, TaskStatus.VERIFIED] } } }),
    ]);

    // 2. Personnel counts
    const personnelAggregation = await prisma.personnel.groupBy({
      by: ['availabilityStatus'],
      _count: { _all: true },
    });

    const activeStaff = personnelAggregation.find((a) => a.availabilityStatus !== 'OFF_DUTY')?._count._all || 0;
    const totalPersonnel = await prisma.personnel.count();

    // 3. Today's Attendance summary
    const todayAttendance = await prisma.attendance.findMany({
      where: { date: { gte: todayRange.start, lte: todayRange.end } },
    });

    const attendanceStats = {
      present: todayAttendance.filter((a) => a.status === AttendanceStatus.PRESENT).length,
      absent: todayAttendance.filter((a) => a.status === AttendanceStatus.ABSENT).length,
      leave: todayAttendance.filter((a) => a.status === AttendanceStatus.LEAVE).length,
      halfDay: todayAttendance.filter((a) => a.status === AttendanceStatus.HALF_DAY).length,
      totalStaff: totalPersonnel,
    };

    // 4. Pending Tickets list for quick action
    const pendingTicketsList = await prisma.ticket.findMany({
      where: { status: TicketStatus.OPEN },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 5,
      include: {
        resident: {
          select: { id: true, firstName: true, lastName: true, unitNumber: true, phoneNumber: true },
        },
      },
    });

    // 5. Recent Activities
    const [recentTickets, recentTasks, recentAttendance] = await Promise.all([
      prisma.ticket.findMany({
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: { resident: { select: { firstName: true, unitNumber: true } } },
      }),
      prisma.task.findMany({
        take: 4,
        orderBy: { updatedAt: 'desc' },
        include: {
          ticket: { select: { title: true, category: true } },
          assignedPersonnel: { select: { name: true, category: true } },
        },
      }),
      prisma.attendance.findMany({
        take: 3,
        orderBy: { updatedAt: 'desc' },
        include: { personnel: { select: { name: true, category: true } } },
      }),
    ]);

    const activities: any[] = [];

    recentTickets.forEach((t) => {
      activities.push({
        id: `ticket-${t.id}`,
        type: 'COMPLAINT',
        title: `New complaint from Unit ${t.resident.unitNumber || '9A'}`,
        description: `${t.title} (${t.category})`,
        time: t.createdAt,
        status: t.status,
      });
    });

    recentTasks.forEach((tsk) => {
      activities.push({
        id: `task-${tsk.id}`,
        type: 'TASK',
        title: `Task ${tsk.status.toLowerCase().replace('_', ' ')}: ${tsk.assignedPersonnel.name}`,
        description: tsk.ticket?.title || 'Operational Task',
        time: tsk.updatedAt,
        status: tsk.status,
      });
    });

    recentAttendance.forEach((att) => {
      activities.push({
        id: `att-${att.id}`,
        type: 'ATTENDANCE',
        title: `Attendance updated: ${att.personnel.name}`,
        description: `Marked as ${att.status}`,
        time: att.updatedAt,
        status: att.status,
      });
    });

    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // 6. Category breakdown of personnel
    const personnelByCategory = await prisma.personnel.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        availabilityStatus: true,
        tasks: {
          where: { status: { in: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS] } },
          select: { id: true },
        },
      },
    });

    const stats = {
      pendingTickets,
      assignedTasks,
      inProgressTasks,
      completedTasks,
      activeStaff,
      totalPersonnel,
    };

    res.json({
      success: true,
      stats,
      pendingTickets,
      assignedTasks,
      inProgressTasks,
      completedTasks,
      activeStaff,
      totalPersonnel,
      attendanceStats,
      pendingTicketsList,
      recentActivity: activities.slice(0, 8),
      personnelByCategory,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 2. GET /manager/tickets
// ----------------------------------------------------
router.get('/tickets', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const statusQuery = typeof req.query.status === 'string' ? req.query.status : undefined;
    const categoryQuery = typeof req.query.category === 'string' ? req.query.category : undefined;
    const priorityQuery = typeof req.query.priority === 'string' ? req.query.priority : undefined;
    const searchQuery = typeof req.query.search === 'string' ? req.query.search : undefined;

    const where: any = {};
    if (statusQuery && statusQuery !== 'ALL') {
      where.status = statusQuery as TicketStatus;
    }
    if (categoryQuery && categoryQuery !== 'ALL') {
      where.category = { contains: categoryQuery, mode: 'insensitive' };
    }
    if (priorityQuery && priorityQuery !== 'ALL') {
      where.priority = priorityQuery as TicketPriority;
    }
    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { resident: { firstName: { contains: searchQuery, mode: 'insensitive' } } },
        { resident: { unitNumber: { contains: searchQuery, mode: 'insensitive' } } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        resident: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            unitNumber: true,
            phoneNumber: true,
            email: true,
          },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedPersonnel: {
              select: {
                id: true,
                name: true,
                phone: true,
                category: true,
                availabilityStatus: true,
              },
            },
          },
        },
      },
    });

    res.json({ tickets });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 3. GET /manager/tickets/:id
// ----------------------------------------------------
router.get('/tickets/:id', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing ticket id' } });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        resident: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            unitNumber: true,
            phoneNumber: true,
            email: true,
            residencies: {
              where: { status: 'ACTIVE' },
              select: { relationshipType: true, unitId: true },
            },
            ownerships: {
              where: { status: 'ACTIVE' },
              select: { unitId: true },
            },
          },
        },
        unit: {
          include: {
            ownerships: {
              where: { status: 'ACTIVE' },
              include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } } },
            },
            residencies: {
              where: { status: 'ACTIVE' },
              include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } } },
            },
          },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedPersonnel: true,
            assignedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: { message: 'Ticket not found' } });
    }

    const creatorResidency = ticket.resident.residencies.find((r) => r.unitId === ticket.unitId);
    const creatorOwnership = ticket.resident.ownerships.find((o) => o.unitId === ticket.unitId);

    const occupancyType = creatorResidency
      ? creatorResidency.relationshipType
      : creatorOwnership
      ? 'OWNER'
      : 'RESIDENT';

    res.json({
      ...ticket,
      occupancyType,
      unitOwners: ticket.unit?.ownerships.map((o) => o.user) || [],
      currentResidents: ticket.unit?.residencies.map((r) => ({ ...r.user, relationshipType: r.relationshipType })) || [],
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. PATCH /manager/tickets/:id
// ----------------------------------------------------
const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED_BY_WORKER', 'PENDING_RESIDENT_CONFIRMATION', 'CLOSED', 'REOPENED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  remarks: z.string().optional(),
});

router.patch('/tickets/:id', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing ticket id' } });
    }

    const data = updateTicketSchema.parse(req.body);

    const existing = await prisma.ticket.findUnique({ where: { id }, include: { resident: true } });
    if (!existing) {
      return res.status(404).json({ error: { message: 'Ticket not found' } });
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status as TicketStatus } : {}),
        ...(data.priority ? { priority: data.priority as TicketPriority } : {}),
        ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
      },
      include: { resident: true, tasks: { include: { assignedPersonnel: true } } },
    });

    // Notify resident if status changed
    if (data.status && data.status !== existing.status) {
      let title = `Ticket #${id.slice(0, 6)} Updated`;
      let message = `Your issue "${existing.title}" status has been changed to ${data.status.replace('_', ' ')}.`;

      if (data.status === 'PENDING_RESIDENT_CONFIRMATION') {
        title = `Please Verify Ticket #${id.slice(0, 6)}`;
        message = `The work on "${existing.title}" is complete. Please confirm whether the issue is resolved.`;
      } else if (data.status === 'CLOSED') {
        title = `Ticket #${id.slice(0, 6)} Closed`;
        message = `Your maintenance request "${existing.title}" has been closed.`;
      }

      await prisma.notification.create({
        data: {
          userId: existing.residentId,
          type: `TICKET_${data.status}`,
          title,
          message,
          metadata: { ticketId: id },
        },
      });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 5. POST /manager/tasks/assign
// ----------------------------------------------------
const assignTaskSchema = z.object({
  ticketId: z.string(),
  personnelId: z.string(),
  remarks: z.string().optional(),
});

router.post('/tasks/assign', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ticketId, personnelId, remarks } = assignTaskSchema.parse(req.body);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { resident: true },
    });
    if (!ticket) {
      return res.status(404).json({ error: { message: 'Ticket not found' } });
    }

    const personnel = await prisma.personnel.findUnique({
      where: { id: personnelId },
    });
    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel not found' } });
    }

    // Strict validation: OFF_DUTY or LEAVE workers cannot receive tasks
    if (
      personnel.availabilityStatus === AvailabilityStatus.OFF_DUTY ||
      personnel.availabilityStatus === AvailabilityStatus.LEAVE
    ) {
      return res.status(400).json({
        error: {
          message: `Personnel ${personnel.name} is currently ${personnel.availabilityStatus.toLowerCase().replace('_', ' ')} and cannot be assigned tasks.`,
        },
      });
    }

    if (personnel.employmentStatus === 'SUSPENDED' || personnel.employmentStatus === 'TERMINATED') {
      return res.status(400).json({
        error: {
          message: `Personnel ${personnel.name} is currently ${personnel.employmentStatus.toLowerCase()} and cannot receive assignments.`,
        },
      });
    }

    if (!isPersonnelCompatibleWithTicket(personnel.category, ticket.category)) {
      return res.status(400).json({
        error: {
          code: 'PERSONNEL_CATEGORY_MISMATCH',
          message: `${personnel.name} (${personnel.category}) cannot be assigned to a ${ticket.category} task. Assign a worker with the matching trade or department.`,
        },
      });
    }

    // 1. Create Task
    const task = await prisma.task.create({
      data: {
        ticketId,
        assignedPersonnelId: personnelId,
        assignedById: req.user!.userId,
        status: TaskStatus.ASSIGNED,
        remarks: remarks || `Assigned to ${personnel.name}`,
      },
      include: {
        assignedPersonnel: true,
        assignedBy: { select: { firstName: true, lastName: true } },
      },
    });

    // 2. Update Ticket status to ASSIGNED
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.ASSIGNED },
    });

    // 3. Mark personnel as BUSY if currently AVAILABLE
    if (personnel.availabilityStatus === AvailabilityStatus.AVAILABLE) {
      await prisma.personnel.update({
        where: { id: personnelId },
        data: { availabilityStatus: AvailabilityStatus.BUSY },
      });
    }

    // 4. Send Notification to Resident
    await prisma.notification.create({
      data: {
        userId: ticket.residentId,
        type: 'TASK_ASSIGNED',
        title: `Personnel Assigned to Ticket #${ticket.id.slice(0, 6)}`,
        message: `${personnel.name} (${personnel.category}) has been assigned to your request: "${ticket.title}".`,
        metadata: { ticketId, taskId: task.id, personnelId },
      },
    });

    // 5. If personnel has a linked app user, send them a task notification
    if (personnel.userId) {
      await prisma.notification.create({
        data: {
          userId: personnel.userId,
          type: 'NEW_TASK_ASSIGNED',
          title: `New Task Assigned: Ticket #${ticket.id.slice(0, 6)}`,
          message: `You have been assigned to "${ticket.title}".`,
          metadata: { ticketId, taskId: task.id },
        },
      });
    }

    res.status(201).json({
      success: true,
      task,
      message: `Assigned ${personnel.name} to ticket successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 6. GET /manager/tasks (List all tasks)
// ----------------------------------------------------
router.get('/tasks', requireWorkforceOrManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const statusQuery = typeof req.query.status === 'string' ? req.query.status : undefined;
    const personnelIdQuery = typeof req.query.personnelId === 'string' ? req.query.personnelId : undefined;
    const ticketIdQuery = typeof req.query.ticketId === 'string' ? req.query.ticketId : undefined;

    const where: any = {};
    if (statusQuery && statusQuery !== 'ALL') {
      where.status = statusQuery as TaskStatus;
    }
    if (personnelIdQuery) {
      where.assignedPersonnelId = personnelIdQuery;
    }
    if (ticketIdQuery) {
      where.ticketId = ticketIdQuery;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        assignedPersonnel: true,
        assignedBy: { select: { firstName: true, lastName: true } },
        ticket: {
          include: {
            resident: { select: { id: true, firstName: true, lastName: true, unitNumber: true, phoneNumber: true } },
          },
        },
      },
    });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 7. PATCH /manager/tasks/:id & /manager/tasks/:id/status
// ----------------------------------------------------
const updateTaskSchema = z.object({
  status: z.enum(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED']),
  remarks: z.string().optional(),
});

const handleTaskStatusUpdate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing task id' } });
    }

    const { status, remarks } = updateTaskSchema.parse(req.body);

    const task = await prisma.task.findUnique({
      where: { id },
      include: { ticket: { include: { resident: true } }, assignedPersonnel: true },
    });

    if (!task) {
      return res.status(404).json({ error: { message: 'Task not found' } });
    }

    const updateData: any = {
      status: status as TaskStatus,
      ...(remarks !== undefined ? { remarks } : {}),
    };

    if (status === 'IN_PROGRESS' && !task.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === 'COMPLETED' && !task.completedAt) {
      updateData.completedAt = new Date();
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { assignedPersonnel: true, ticket: true },
    });

    // Mirror status to Ticket
    let ticketStatus = task.ticket.status;
    if (status === 'IN_PROGRESS') ticketStatus = TicketStatus.IN_PROGRESS;
    if (status === 'COMPLETED') ticketStatus = TicketStatus.COMPLETED_BY_WORKER;
    if (status === 'VERIFIED') ticketStatus = TicketStatus.PENDING_RESIDENT_CONFIRMATION;
    if (status === 'CANCELLED') ticketStatus = TicketStatus.OPEN; // revert to pending for reassignment

    await prisma.ticket.update({
      where: { id: task.ticketId },
      data: { status: ticketStatus },
    });

    // Check personnel availability on completion
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      const activeTasks = await prisma.task.count({
        where: {
          assignedPersonnelId: task.assignedPersonnelId,
          id: { not: id },
          status: { in: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS] },
        },
      });

      if (activeTasks === 0 && task.assignedPersonnel.availabilityStatus === AvailabilityStatus.BUSY) {
        await prisma.personnel.update({
          where: { id: task.assignedPersonnelId },
          data: { availabilityStatus: AvailabilityStatus.AVAILABLE },
        });
      }
    }

    // Notify Resident
    let notifType = `TASK_${status}`;
    let notifTitle = `Task Update on #${task.ticketId.slice(0, 6)}`;
    let notifMsg = `Task status updated to ${status.replace('_', ' ')}`;

    if (status === 'IN_PROGRESS') {
      notifType = 'WORK_STARTED';
      notifTitle = `Work Started: Ticket #${task.ticketId.slice(0, 6)}`;
      notifMsg = `${task.assignedPersonnel.name} has begun work on "${task.ticket.title}".`;
    } else if (status === 'COMPLETED') {
      notifType = 'WORK_COMPLETED';
      notifTitle = `Work Completed: Ticket #${task.ticketId.slice(0, 6)}`;
      notifMsg = `${task.assignedPersonnel.name} has completed the maintenance task for "${task.ticket.title}".`;
    } else if (status === 'VERIFIED') {
      notifType = 'TICKET_VERIFICATION_REQUEST';
      notifTitle = `Please Verify Ticket #${task.ticketId.slice(0, 6)}`;
      notifMsg = `Management confirmed the work on "${task.ticket.title}". Please verify the result.`;
    }

    await prisma.notification.create({
      data: {
        userId: task.ticket.residentId,
        type: notifType,
        title: notifTitle,
        message: notifMsg,
        metadata: { ticketId: task.ticketId, taskId: id },
      },
    });

    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
};

router.patch('/tasks/:id', requireWorkforceOrManager, handleTaskStatusUpdate);
router.patch('/tasks/:id/status', requireWorkforceOrManager, handleTaskStatusUpdate);

// ----------------------------------------------------
// 8. GET /manager/personnel (Supports available filtering and active workload counts)
// ----------------------------------------------------
router.get('/personnel', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const categoryQuery = typeof req.query.category === 'string' ? req.query.category : undefined;
    const availabilityQuery = typeof req.query.availability === 'string' ? req.query.availability : undefined;
    const onlyAvailable = req.query.available === 'true' || availabilityQuery === 'AVAILABLE';
    const searchQuery = typeof req.query.search === 'string' ? req.query.search : undefined;

    const todayRange = getDateRange();

    const where: any = {};
    if (categoryQuery && categoryQuery !== 'ALL') {
      where.category = categoryQuery as PersonnelCategory;
    }
    if (onlyAvailable) {
      where.availabilityStatus = { notIn: [AvailabilityStatus.OFF_DUTY, AvailabilityStatus.LEAVE] };
    } else if (availabilityQuery && availabilityQuery !== 'ALL') {
      where.availabilityStatus = availabilityQuery as AvailabilityStatus;
    }
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { phone: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    const personnelList = await prisma.personnel.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        attendances: {
          where: { date: { gte: todayRange.start, lte: todayRange.end } },
          take: 1,
        },
        tasks: {
          where: { status: { in: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS] } },
          select: { id: true, status: true, ticket: { select: { title: true, priority: true } } },
        },
      },
    });

    const formatted = personnelList.map((p) => ({
      id: p.id,
      name: p.name,
      trade: p.category,
      category: p.category,
      phone: p.phone,
      availability: p.availabilityStatus,
      availabilityStatus: p.availabilityStatus,
      activeTasks: p.tasks.length,
      activeTasksCount: p.tasks.length,
      tasks: p.tasks,
      todayAttendance: p.attendances[0] || null,
      createdAt: p.createdAt,
    }));

    res.json({ personnel: formatted });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 9. POST /manager/personnel
// ----------------------------------------------------
const createPersonnelSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  category: z.enum(['ELECTRICIAN', 'PLUMBER', 'CLEANER', 'SECURITY', 'GARDENER', 'MAINTENANCE', 'OTHER']),
  availabilityStatus: z.enum(['AVAILABLE', 'BUSY', 'OFF_DUTY', 'LEAVE']).optional(),
});

router.post('/personnel', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createPersonnelSchema.parse(req.body);

    const personnel = await prisma.personnel.create({
      data: {
        name: data.name,
        phone: data.phone,
        category: data.category as PersonnelCategory,
        availabilityStatus: (data.availabilityStatus as AvailabilityStatus) || AvailabilityStatus.AVAILABLE,
      },
    });

    // Auto-mark present for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.attendance.create({
      data: {
        personnelId: personnel.id,
        date: today,
        status: AttendanceStatus.PRESENT,
        checkIn: new Date(),
        remarks: 'Auto-enrolled today',
      },
    });

    res.status(201).json(personnel);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 10. GET /manager/personnel/:id
// ----------------------------------------------------
router.get('/personnel/:id', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing personnel id' } });
    }

    const personnel = await prisma.personnel.findUnique({
      where: { id },
      include: {
        attendances: {
          orderBy: { date: 'desc' },
          take: 14,
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            ticket: {
              select: {
                id: true,
                title: true,
                category: true,
                priority: true,
                status: true,
                resident: { select: { firstName: true, unitNumber: true } },
              },
            },
          },
        },
      },
    });

    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel not found' } });
    }

    res.json(personnel);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 11. PATCH /manager/personnel/:id
// ----------------------------------------------------
const updatePersonnelSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  category: z.enum(['ELECTRICIAN', 'PLUMBER', 'CLEANER', 'SECURITY', 'GARDENER', 'MAINTENANCE', 'OTHER']).optional(),
  availabilityStatus: z.enum(['AVAILABLE', 'BUSY', 'OFF_DUTY', 'LEAVE']).optional(),
});

router.patch('/personnel/:id', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing personnel id' } });
    }

    const data = updatePersonnelSchema.parse(req.body);

    const updated = await prisma.personnel.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.category ? { category: data.category as PersonnelCategory } : {}),
        ...(data.availabilityStatus ? { availabilityStatus: data.availabilityStatus as AvailabilityStatus } : {}),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 12. GET /manager/attendance
// ----------------------------------------------------
router.get('/attendance', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dateQuery = typeof req.query.date === 'string' ? req.query.date : undefined;
    const range = getDateRange(dateQuery);

    const personnel = await prisma.personnel.findMany({
      orderBy: { name: 'asc' },
      include: {
        attendances: {
          where: { date: { gte: range.start, lte: range.end } },
          take: 1,
        },
      },
    });

    const records = personnel.map((p) => {
      const att = p.attendances[0];
      return {
        personnelId: p.id,
        name: p.name,
        phone: p.phone,
        category: p.category,
        availabilityStatus: p.availabilityStatus,
        attendanceId: att?.id || null,
        status: att?.status || 'ABSENT',
        checkIn: att?.checkIn || null,
        checkOut: att?.checkOut || null,
        remarks: att?.remarks || '',
      };
    });

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      leave: records.filter((r) => r.status === 'LEAVE').length,
      halfDay: records.filter((r) => r.status === 'HALF_DAY').length,
    };

    res.json({ date: range.start.toISOString().split('T')[0], summary, records });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 12a. GET /manager/attendance/export (Export XLSX)
// ----------------------------------------------------
router.get('/attendance/export', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dateQuery = typeof req.query.date === 'string' ? req.query.date : undefined;
    const range = getDateRange(dateQuery);
    const dateStr = range.start.toISOString().split('T')[0];

    const personnel = await prisma.personnel.findMany({
      orderBy: { name: 'asc' },
      include: {
        attendances: {
          where: { date: { gte: range.start, lte: range.end } },
          take: 1,
        },
      },
    });

    const rows = personnel.map((p, idx) => {
      const att = p.attendances[0];
      return {
        'S.No': idx + 1,
        'Employee ID': p.id.slice(0, 8).toUpperCase(),
        'Employee Name': p.name,
        'Trade / Category': p.category,
        'Phone Number': p.phone,
        Date: dateStr,
        Status: att?.status || 'ABSENT',
        'Check-In': att?.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        'Check-Out': att?.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        Remarks: att?.remarks || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Attendance-${dateStr}`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="regency-salma-attendance-${dateStr}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 12b. POST /manager/attendance/import (Import Attendance records)
// ----------------------------------------------------
const importRowSchema = z.object({
  personnelId: z.string().optional(),
  name: z.string().optional(),
  date: z.string().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY']),
  remarks: z.string().optional(),
});

const importPayloadSchema = z.object({
  records: z.array(importRowSchema),
});

router.post('/attendance/import', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { records } = importPayloadSchema.parse(req.body);
    let updatedCount = 0;

    for (const row of records) {
      let targetPersonnelId = row.personnelId;

      if (!targetPersonnelId && row.name) {
        const found = await prisma.personnel.findFirst({
          where: { name: { equals: row.name, mode: 'insensitive' } },
        });
        if (found) targetPersonnelId = found.id;
      }

      if (targetPersonnelId) {
        await saveAttendance(targetPersonnelId, {
          personnelId: targetPersonnelId,
          date: row.date,
          status: row.status,
          remarks: row.remarks || 'Imported via management console',
        });
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Successfully imported attendance for ${updatedCount} personnel records.`,
      updatedCount,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 13. POST /manager/attendance & PATCH /manager/personnel/:id/attendance
// ----------------------------------------------------
const markAttendanceSchema = z.object({
  personnelId: z.string().uuid().optional(),
  date: z.string().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY']),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  remarks: z.string().optional(),
});

async function saveAttendance(personnelId: string, data: z.infer<typeof markAttendanceSchema>) {
  const range = getDateRange(data.date);

  const existing = await prisma.attendance.findFirst({
    where: {
      personnelId,
      date: { gte: range.start, lte: range.end },
    },
  });

  let attRecord;
  if (existing) {
    attRecord = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: data.status as AttendanceStatus,
        ...(data.checkIn !== undefined ? { checkIn: data.checkIn ? new Date(data.checkIn) : null } : {}),
        ...(data.checkOut !== undefined ? { checkOut: data.checkOut ? new Date(data.checkOut) : null } : {}),
        ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
      },
    });
  } else {
    attRecord = await prisma.attendance.create({
      data: {
        personnelId,
        date: range.start,
        status: data.status as AttendanceStatus,
        checkIn: data.checkIn ? new Date(data.checkIn) : data.status === 'PRESENT' ? new Date() : null,
        checkOut: data.checkOut ? new Date(data.checkOut) : null,
        remarks: data.remarks || '',
      },
    });
  }

  // Sync personnel availability
  let newAvailability: AvailabilityStatus = AvailabilityStatus.AVAILABLE;
  if (data.status === 'LEAVE') newAvailability = AvailabilityStatus.LEAVE;
  if (data.status === 'ABSENT') newAvailability = AvailabilityStatus.OFF_DUTY;

  if (data.status === 'PRESENT' || data.status === 'HALF_DAY') {
    const activeTasks = await prisma.task.count({
      where: {
        assignedPersonnelId: personnelId,
        status: { in: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS] },
      },
    });
    newAvailability = activeTasks > 0 ? AvailabilityStatus.BUSY : AvailabilityStatus.AVAILABLE;
  }

  await prisma.personnel.update({
    where: { id: personnelId },
    data: { availabilityStatus: newAvailability },
  });

  return attRecord;
}

router.post('/attendance', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = markAttendanceSchema.parse(req.body);
    if (!data.personnelId) {
      return res.status(400).json({ error: { message: 'Missing personnelId in request body' } });
    }

    const attRecord = await saveAttendance(data.personnelId, data);
    res.json({ success: true, attendance: attRecord });
  } catch (error) {
    next(error);
  }
});

router.patch('/personnel/:id/attendance', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing personnel id' } });
    }

    const data = markAttendanceSchema.parse(req.body);
    const attRecord = await saveAttendance(id, data);
    res.json({ success: true, attendance: attRecord });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 14. LEADERSHIP: POST /manager/roles/assign-manager & /manager/roles/remove-manager
// ----------------------------------------------------
const managerRoleSchema = z.object({
  userId: z.string().uuid(),
  communityId: z.string().uuid().optional(),
});

router.post('/roles/assign-manager', requireLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, communityId } = managerRoleSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    // Update user role to MANAGER
    await prisma.user.update({
      where: { id: userId },
      data: { role: Role.MANAGER },
    });

    if (communityId) {
      await prisma.membership.upsert({
        where: {
          userId_communityId_role: {
            userId,
            communityId,
            role: Role.MANAGER,
          },
        },
        update: { status: 'APPROVED' },
        create: {
          userId,
          communityId,
          role: Role.MANAGER,
          status: 'APPROVED',
        },
      });
    }

    await prisma.notification.create({
      data: {
        userId,
        type: 'ROLE_PROMOTED',
        title: 'Manager Role Assigned',
        message: 'You have been granted Township Operations Manager privileges.',
      },
    });

    res.json({ success: true, message: 'Assigned manager privileges successfully.' });
  } catch (error) {
    next(error);
  }
});

router.post('/roles/remove-manager', requireLeadership, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, communityId } = managerRoleSchema.parse(req.body);

    await prisma.user.update({
      where: { id: userId },
      data: { role: Role.RESIDENT },
    });

    await prisma.membership.deleteMany({
      where: {
        userId,
        role: Role.MANAGER,
        ...(communityId ? { communityId } : {}),
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'ROLE_REVOKED',
        title: 'Manager Role Revoked',
        message: 'Your Township Operations Manager privileges have been revoked by Leadership.',
      },
    });

    res.json({ success: true, message: 'Removed manager privileges.' });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 19. GET /manager/workforce/pending
// ----------------------------------------------------
router.get('/workforce/pending', requireManager, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pendingWorkforce = await prisma.membership.findMany({
      where: {
        role: Role.WORKFORCE,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            createdAt: true,
          },
        },
        community: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ pendingWorkforce });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 20. POST /manager/workforce/:id/approve
// ----------------------------------------------------
router.post('/workforce/:id/approve', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing membership id' } });
    }

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!membership) {
      return res.status(404).json({ error: { message: 'Membership application not found' } });
    }

    // Constraint: Manager CANNOT approve a Manager
    if (membership.role === Role.MANAGER) {
      return res.status(403).json({ error: { message: 'Only Leadership can approve Manager applications' } });
    }

    // 1. Approve membership
    const updatedMembership = await prisma.membership.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    // 2. Update user role to WORKFORCE
    await prisma.user.update({
      where: { id: membership.userId },
      data: { role: Role.WORKFORCE },
    });

    // 3. Create or link Personnel profile
    const existingPersonnel = await prisma.personnel.findUnique({
      where: { userId: membership.userId },
    });
    
    // Map enums
    const reqCategory = membership.requestedCategory || 'MAINTENANCE';
    const reqDepartment = membership.requestedDepartment || 'MAINTENANCE';

    if (!existingPersonnel) {
      await prisma.personnel.create({
        data: {
          userId: membership.userId,
          name: `${membership.user.firstName || ''} ${membership.user.lastName || ''}`.trim() || 'Workforce Staff',
          phone: membership.user.phoneNumber || '+91 00000 00000',
          communityId: membership.communityId,
          category: reqCategory as any,
          department: reqDepartment as any,
          availabilityStatus: AvailabilityStatus.OFF_DUTY,
          employmentStatus: 'ACTIVE',
        },
      });
    } else {
      await prisma.personnel.update({
        where: { id: existingPersonnel.id },
        data: {
          category: reqCategory as any,
          department: reqDepartment as any,
          employmentStatus: 'ACTIVE',
          availabilityStatus: AvailabilityStatus.OFF_DUTY,
        },
      });
    }

    // 4. Notify applicant
    await prisma.notification.create({
      data: {
        userId: membership.userId,
        type: 'WORKFORCE_APPROVED',
        title: 'Workforce Application Approved',
        message: 'Your application for Regency Salma staff workforce access has been approved.',
      },
    });

    res.json({
      success: true,
      message: `Approved ${membership.user.firstName || 'Staff Member'} as active workforce.`,
      membership: updatedMembership,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 21. POST /manager/workforce/:id/reject
// ----------------------------------------------------
router.post('/workforce/:id/reject', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing membership id' } });
    }

    const membership = await prisma.membership.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!membership) {
      return res.status(404).json({ error: { message: 'Membership application not found' } });
    }

    const updated = await prisma.membership.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await prisma.notification.create({
      data: {
        userId: membership.userId,
        type: 'WORKFORCE_REJECTED',
        title: 'Staff Application Update',
        message: 'Your application for staff access was not approved.',
      },
    });

    res.json({
      success: true,
      message: 'Workforce application rejected.',
      membership: updated,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 22. PATCH /manager/personnel/:id/status
// ----------------------------------------------------
const updatePersonnelStatusSchema = z.object({
  employmentStatus: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED']).optional(),
  availabilityStatus: z.enum(['AVAILABLE', 'BUSY', 'OFF_DUTY', 'LEAVE']).optional(),
  department: z.enum(['SECURITY', 'HOUSEKEEPING', 'MAINTENANCE', 'GARDENING', 'OTHER']).optional(),
  designation: z.string().optional(),
});

router.patch('/personnel/:id/status', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing personnel id' } });
    }

    const data = updatePersonnelStatusSchema.parse(req.body);

    const personnel = await prisma.personnel.findUnique({ where: { id } });
    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel not found' } });
    }

    const updateData: any = {};
    if (data.employmentStatus) updateData.employmentStatus = data.employmentStatus;
    if (data.availabilityStatus) updateData.availabilityStatus = data.availabilityStatus;
    if (data.department) updateData.department = data.department;
    if (data.designation !== undefined) updateData.designation = data.designation;

    const updated = await prisma.personnel.update({
      where: { id },
      data: updateData,
    });

    // If employmentStatus changed and worker has a linked User
    if (data.employmentStatus && personnel.userId) {
      if (data.employmentStatus === 'TERMINATED') {
        await prisma.membership.updateMany({
          where: { userId: personnel.userId, role: Role.WORKFORCE },
          data: { status: 'SUSPENDED' },
        });

        await prisma.notification.create({
          data: {
            userId: personnel.userId,
            type: 'EMPLOYMENT_TERMINATED',
            title: 'Employment Status Update',
            message: 'Your workforce profile and access have been terminated by management.',
          },
        });
      } else if (data.employmentStatus === 'SUSPENDED') {
        await prisma.notification.create({
          data: {
            userId: personnel.userId,
            type: 'EMPLOYMENT_SUSPENDED',
            title: 'Employment Suspended',
            message: 'Your workforce operational privileges are currently suspended.',
          },
        });
      }
    }

    res.json({
      success: true,
      personnel: updated,
      message: `Updated personnel profile successfully.`,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 23. GET /manager/personnel/:id/activities
// ----------------------------------------------------
router.get('/personnel/:id/activities', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Missing personnel id' } });
    }

    const activities = await prisma.personnelActivity.findMany({
      where: { personnelId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ activities });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// POST /manager/tickets/:id/approve-work-completion
// ----------------------------------------------------
router.post('/tickets/:id/approve-work-completion', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ticketId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!ticketId) {
      return res.status(400).json({ error: { message: 'Missing ticket id' } });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { tasks: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!ticket) {
      return res.status(404).json({ error: { message: 'Ticket not found' } });
    }

    if (ticket.status !== TicketStatus.COMPLETED_BY_WORKER) {
      return res.status(400).json({ error: { message: 'Ticket is not in COMPLETED_BY_WORKER state' } });
    }

    const [updatedTicket, verification] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.PENDING_RESIDENT_CONFIRMATION },
      }),
      prisma.ticketVerification.create({
        data: {
          ticketId,
          verifierId: req.user!.userId,
          type: 'MANAGER_VALIDATION',
          decision: 'ACCEPTED',
          createdByRole: 'MANAGER',
        },
      }),
    ]);

    // Send notification to Resident
    await prisma.notification.create({
      data: {
        userId: ticket.residentId,
        type: 'TICKET_VERIFICATION_REQUEST',
        title: 'Please Verify Maintenance Work',
        message: 'The manager has confirmed the work is completed. Please verify that the issue is resolved.',
        metadata: { ticketId: ticket.id },
      },
    });

    res.json({ success: true, ticket: updatedTicket, verification });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, requireWorkforce, requireManager, AuthRequest } from '../middleware/auth';
import {
  AvailabilityStatus,
  AttendanceStatus,
  Department,
  MembershipStatus,
  PersonnelCategory,
  Role,
  TaskStatus,
  TicketStatus,
  PersonnelActivityType,
  SpaceType,
} from '@prisma/client';

const router = Router();

// All workforce routes require authentication and workforce/manager role
router.use(requireAuth);
router.use(requireWorkforce);

// Helper to get or auto-link the Personnel profile for the authenticated worker
async function getWorkerPersonnel(userId: string) {
  const workforceMembership = await prisma.membership.findFirst({
    where: {
      userId,
      role: Role.WORKFORCE,
      status: MembershipStatus.APPROVED,
    },
    select: {
      requestedCategory: true,
      requestedDepartment: true,
    },
  });

  const requestedCategory = workforceMembership?.requestedCategory;
  const requestedDepartment = workforceMembership?.requestedDepartment;
  const hasSavedClassification = Boolean(
    requestedCategory &&
      requestedDepartment &&
      Object.values(PersonnelCategory).includes(requestedCategory as PersonnelCategory) &&
      Object.values(Department).includes(requestedDepartment as Department)
  );

  let personnel = await prisma.personnel.findUnique({
    where: { userId },
    include: {
      attendances: {
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        take: 1,
      },
    },
  });

  if (!personnel) {
    // If not directly linked by userId, check by phone or create one from user record
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      if (user.phoneNumber) {
        const byPhone = await prisma.personnel.findFirst({ where: { phone: user.phoneNumber } });
        if (byPhone) {
          personnel = await prisma.personnel.update({
            where: { id: byPhone.id },
            data: { userId: user.id },
            include: {
              attendances: {
                where: {
                  date: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    lte: new Date(new Date().setHours(23, 59, 59, 999)),
                  },
                },
                take: 1,
              },
            },
          });
        }
      }

      if (!personnel) {
        personnel = await prisma.personnel.create({
          data: {
            userId: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff Member',
            phone: user.phoneNumber || '+91 00000 00000',
            // A missing profile must never silently become Maintenance. Use
            // the approved onboarding classification or the neutral OTHER
            // fallback for legacy workforce records.
            category: hasSavedClassification ? requestedCategory as PersonnelCategory : PersonnelCategory.OTHER,
            department: hasSavedClassification ? requestedDepartment as Department : Department.OTHER,
            availabilityStatus: AvailabilityStatus.OFF_DUTY,
          },
          include: { attendances: true },
        });
      }
    }
  }

  // Reconcile profiles created before staff classifications were persisted.
  // This only acts when the worker has an explicit, approved classification.
  if (
    personnel &&
    hasSavedClassification &&
    (personnel.category !== requestedCategory || personnel.department !== requestedDepartment)
  ) {
    personnel = await prisma.personnel.update({
      where: { id: personnel.id },
      data: {
        category: requestedCategory as PersonnelCategory,
        department: requestedDepartment as Department,
      },
      include: {
        attendances: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
          take: 1,
        },
      },
    });
  }

  return personnel;
}

// ----------------------------------------------------
// 1. GET /work/dashboard
// ----------------------------------------------------
router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const personnel = await getWorkerPersonnel(userId);

    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel profile not found' } });
    }

    // Security personnel operate the gate and do not receive maintenance tasks.
    const assignedTasks = personnel.category === 'SECURITY' ? [] : await prisma.task.findMany({
      where: {
        assignedPersonnelId: personnel.id,
        status: { in: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS] },
      },
      include: {
        ticket: {
          include: {
            resident: {
              select: { id: true, firstName: true, lastName: true, unitNumber: true, phoneNumber: true },
            },
            unit: { select: { id: true, unitNumber: true, floor: true, block: true } },
          },
        },
      },
      orderBy: [{ ticket: { priority: 'desc' } }, { createdAt: 'desc' }],
    });

    // 2. Fetch township announcements
    const emergencySpace = await prisma.space.findFirst({ where: { type: SpaceType.EMERGENCY } });
    const announcements = await prisma.announcement.findMany({
      where: emergencySpace ? { spaceId: emergencySpace.id } : {},
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
    });

    // 3. Today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAttendance = await prisma.attendance.findFirst({
      where: {
        personnelId: personnel.id,
        date: { gte: today },
      },
    });

    res.json({
      personnelProfile: {
        id: personnel.id,
        name: personnel.name,
        phone: personnel.phone,
        category: personnel.category,
        department: personnel.department,
        designation: personnel.designation,
        employmentStatus: personnel.employmentStatus,
        availabilityStatus: personnel.availabilityStatus,
        joiningDate: personnel.joiningDate,
      },
      assignedTasks: assignedTasks.map((t) => ({
        id: t.id,
        ticketId: t.ticketId,
        status: t.status,
        remarks: t.remarks,
        startedAt: t.startedAt,
        createdAt: t.createdAt,
        ticket: {
          id: t.ticket.id,
          title: t.ticket.title,
          category: t.ticket.category,
          priority: t.ticket.priority,
          description: t.ticket.description,
          residentName: `${t.ticket.resident.firstName || ''} ${t.ticket.resident.lastName || ''}`.trim(),
          residentPhone: t.ticket.resident.phoneNumber,
          unitNumber: t.ticket.unit?.unitNumber || t.ticket.resident.unitNumber || '9A',
        },
      })),
      announcements,
      todayAttendance: todayAttendance || {
        status: AttendanceStatus.PRESENT,
        checkIn: null,
        checkOut: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 2. GET /work/tasks/history (Completed tasks for the worker)
// ----------------------------------------------------
router.get('/tasks/history', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const personnel = await getWorkerPersonnel(userId);

    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel profile not found' } });
    }

    if (personnel.category === 'SECURITY') {
      return res.json({ history: [] });
    }

    const history = await prisma.task.findMany({
      where: {
        assignedPersonnelId: personnel.id,
        status: TaskStatus.COMPLETED,
      },
      include: {
        ticket: {
          include: {
            resident: { select: { id: true, firstName: true, lastName: true, unitNumber: true } },
            unit: { select: { id: true, unitNumber: true, floor: true, block: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    res.json({
      history: history.map((t) => ({
        id: t.id,
        ticketId: t.ticketId,
        status: t.status,
        remarks: t.remarks,
        completedAt: t.completedAt,
        createdAt: t.createdAt,
        ticket: {
          id: t.ticket.id,
          title: t.ticket.title,
          category: t.ticket.category,
          priority: t.ticket.priority,
          description: t.ticket.description,
          residentName: `${t.ticket.resident.firstName || ''} ${t.ticket.resident.lastName || ''}`.trim(),
          unitNumber: t.ticket.unit?.unitNumber || t.ticket.resident.unitNumber || '9A',
        },
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 3. PATCH /work/availability
// ----------------------------------------------------
const availabilitySchema = z.object({
  availabilityStatus: z.enum(['AVAILABLE', 'BUSY', 'OFF_DUTY', 'LEAVE']),
});

router.patch('/availability', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { availabilityStatus } = availabilitySchema.parse(req.body);

    const personnel = await getWorkerPersonnel(userId);
    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel profile not found' } });
    }

    const updated = await prisma.personnel.update({
      where: { id: personnel.id },
      data: { availabilityStatus: availabilityStatus as AvailabilityStatus },
    });

    // Log Activity
    await prisma.personnelActivity.create({
      data: {
        personnelId: personnel.id,
        type: PersonnelActivityType.ATTENDANCE_MARKED,
        description: `Availability updated to ${availabilityStatus}`,
      },
    });

    res.json({
      success: true,
      availabilityStatus: updated.availabilityStatus,
      message: `Duty status updated to ${availabilityStatus}`,
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 3. POST /work/tasks/:id/complete
// ----------------------------------------------------
const completeTaskSchema = z.object({
  notes: z.string().optional(),
  remarks: z.string().optional(),
  photos: z.array(z.string()).optional(),
}).refine(data => !!(data.notes || data.remarks), {
  message: 'Notes or remarks are required',
});

router.post('/tasks/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const taskId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!taskId) {
      return res.status(400).json({ error: { message: 'Missing task id' } });
    }

    const { notes, remarks } = completeTaskSchema.parse(req.body);
    const finalRemarks = notes || remarks || 'Work completed by personnel';
    const personnel = await getWorkerPersonnel(userId);

    if (personnel?.category === 'SECURITY') {
      return res.status(403).json({ error: { message: 'Security personnel are limited to gate operations.' } });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { ticket: true, assignedPersonnel: true },
    });

    if (!task) {
      return res.status(404).json({ error: { message: 'Task not found' } });
    }

    // Verify ownership of the assigned task (or manager permissions)
    if (task.assignedPersonnelId !== personnel?.id && req.user!.role !== 'MANAGER' && req.user!.role !== 'LEADERSHIP') {
      return res.status(403).json({ error: { message: 'You are not assigned to this task' } });
    }

    if (personnel?.employmentStatus === 'SUSPENDED' || personnel?.employmentStatus === 'TERMINATED') {
      return res.status(403).json({
        error: { message: `Cannot complete task: Account is currently ${personnel.employmentStatus.toLowerCase()}` },
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        remarks: finalRemarks || null,
      },
      include: { ticket: true },
    });

    // Mirror to Ticket
    await prisma.ticket.update({
      where: { id: task.ticketId },
      data: { status: TicketStatus.COMPLETED_BY_WORKER },
    });

    // Create PersonnelActivity
    await prisma.personnelActivity.create({
      data: {
        personnelId: task.assignedPersonnelId,
        type: PersonnelActivityType.TASK_COMPLETED,
        description: `Completed task for ticket: ${task.ticket.title}`,
        referenceId: task.ticketId,
      },
    });

    // Notify Resident
    await prisma.notification.create({
      data: {
        userId: task.ticket.residentId,
        type: 'WORK_COMPLETED',
        title: `Work Completed: Ticket #${task.ticket.id.slice(0, 6)}`,
        message: `${task.assignedPersonnel.name} has completed work on "${task.ticket.title}".`,
        metadata: { ticketId: task.ticketId, taskId: task.id },
      },
    });

    res.json({
      success: true,
      task: updatedTask,
      message: 'Task marked as completed.',
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. POST /work/attendance/check-in
// ----------------------------------------------------
router.post('/attendance/check-in', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const personnel = await getWorkerPersonnel(userId);
    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel profile not found' } });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await prisma.attendance.findFirst({
      where: { personnelId: personnel.id, date: { gte: today } },
    });

    if (attendance) {
      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          status: AttendanceStatus.PRESENT,
          checkIn: attendance.checkIn || new Date(),
        },
      });
    } else {
      attendance = await prisma.attendance.create({
        data: {
          personnelId: personnel.id,
          date: today,
          status: AttendanceStatus.PRESENT,
          checkIn: new Date(),
        },
      });
    }

    await prisma.personnelActivity.create({
      data: {
        personnelId: personnel.id,
        type: PersonnelActivityType.ATTENDANCE_MARKED,
        description: 'Checked in for duty',
        referenceId: attendance.id,
      },
    });

    res.json({ success: true, attendance });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 5. POST /work/attendance/check-out
// ----------------------------------------------------
router.post('/attendance/check-out', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const personnel = await getWorkerPersonnel(userId);
    if (!personnel) {
      return res.status(404).json({ error: { message: 'Personnel profile not found' } });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: { personnelId: personnel.id, date: { gte: today } },
    });

    if (!attendance) {
      return res.status(400).json({ error: { message: 'No active check-in record for today' } });
    }

    if (!attendance.confirmedAt) {
      return res.status(403).json({ error: { message: 'You cannot check out because today’s attendance has not been confirmed by a Manager.' } });
    }
    if (attendance.checkOut) {
      return res.json({ success: true, attendance });
    }

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut: new Date() },
    });

    // Also update availability to OFF_DUTY on checkout
    await prisma.personnel.update({
      where: { id: personnel.id },
      data: { availabilityStatus: AvailabilityStatus.OFF_DUTY },
    });

    await prisma.personnelActivity.create({
      data: {
        personnelId: personnel.id,
        type: PersonnelActivityType.ATTENDANCE_MARKED,
        description: 'Checked out from duty',
        referenceId: attendance.id,
      },
    });

    res.json({ success: true, attendance: updated });
  } catch (error) {
    next(error);
  }
});


// ----------------------------------------------------
// POST /work/attendance/:id/confirm (Manager/Leadership)
// ----------------------------------------------------
router.post('/attendance/:id/confirm', requireManager, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const attendanceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!attendanceId) return res.status(400).json({ error: { message: 'Missing id' } });
    const userId = req.user!.userId;

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: { personnel: true }
    });

    if (!attendance) {
      return res.status(404).json({ error: { message: 'Attendance record not found' } });
    }

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { 
        confirmedById: userId,
        confirmedAt: new Date()
      }
    });

    res.json({ success: true, attendance: updated });
  } catch(error) {
    next(error);
  }
});

export default router;

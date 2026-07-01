export const PRE_ALLOCATION_JOB_STATUSES = new Set(['draft', 'posted', 'received', 'awarded']);

export const buildDriverAssignmentUpdate = ({
  assignedDriverId,
  currentStatus,
  updatedAt = new Date().toISOString(),
}: {
  assignedDriverId: string | null;
  currentStatus: string;
  updatedAt?: string;
}) => {
  const normalizedStatus = (currentStatus || '').toLowerCase();

  let nextStatus = currentStatus;
  if (assignedDriverId && PRE_ALLOCATION_JOB_STATUSES.has(normalizedStatus)) {
    nextStatus = 'allocated';
  } else if (!assignedDriverId && normalizedStatus === 'allocated') {
    nextStatus = 'posted';
  }

  return {
    assigned_driver_id: assignedDriverId || null,
    status: nextStatus,
    updated_at: updatedAt,
  };
};

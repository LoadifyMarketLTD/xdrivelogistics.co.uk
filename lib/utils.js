/**
 * Format shipment status for display
 * @param {string} status - Raw status value
 * @returns {string} Formatted status
 */
export function formatStatus(status) {
  if (!status) return 'Unknown'
  
  const statusMap = {
    'pending': 'Pending',
    'accepted': 'Accepted',
    'in_transit': 'In Transit',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
  }
  
  return statusMap[status] || status
}

/**
 * Get Tailwind CSS classes for status badge styling
 * @param {string} status - Raw status value
 * @returns {string} Tailwind classes
 */
export function getStatusClasses(status) {
  const classMap = {
    'pending': 'bg-yellow-500/20 text-yellow-400',
    'accepted': 'bg-emerald-500/20 text-emerald-400',
    'in_transit': 'bg-blue-500/20 text-blue-400',
    'completed': 'bg-slate-500/20 text-slate-400',
    'cancelled': 'bg-red-500/20 text-red-400',
  }
  
  return classMap[status] || 'bg-slate-500/20 text-slate-400'
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

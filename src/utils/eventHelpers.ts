export function getEventColor(type?: string, severity?: string) {
  if (severity === 'critical' || severity === 'danger') return '#FF3B30';

  const normalizedType = type?.toLocaleLowerCase('vi');
  if (normalizedType?.includes('cồn')) return '#FF9500';
  if (normalizedType?.includes('ngã') || normalizedType?.includes('va đập')) {
    return '#FF3B30';
  }

  return '#007AFF';
}

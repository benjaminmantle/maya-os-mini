// v4 → v5 migration: adds frogsComplete field, dailies from v4 may be missing
export function migrateV4toV5() {
  try {
    const old = localStorage.getItem('maya_os_v4');
    if (!old) return null;
    const d = JSON.parse(old);
    return {
      tasks: d.tasks || [],
      dailies: d.dailies || [],
      days: d.days || {},
      profile: d.profile || { level: 1, exp: 0, streak: 0, longest: 0, perfect: 0, momentum: 'stable' },
      target: d.target || 10,
      frogsComplete: {},
    };
  } catch (e) {
    console.warn('v4→v5 migration failed:', e);
    return null;
  }
}

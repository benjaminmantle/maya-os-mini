/* Group/ungroup logic */

const _uid = () => 'grp_' + Math.random().toString(36).slice(2, 10);

/**
 * Group the given element IDs together.
 * Sets groupId on all elements, adds group metadata to board.groups.
 * Returns the new group ID.
 */
export function groupElements(elementIds, elements, groups) {
  const gid = _uid();
  for (const id of elementIds) {
    const el = elements.find(e => e.id === id);
    if (el) el.groupId = gid;
  }
  groups[gid] = { id: gid, label: '' };
  return gid;
}

/**
 * Ungroup: clear groupId on all members, remove from groups map.
 */
export function ungroupElements(groupId, elements, groups) {
  for (const el of elements) {
    if (el.groupId === groupId) el.groupId = null;
  }
  delete groups[groupId];
}

/** Get all elements in a group */
export function getGroupMembers(groupId, elements) {
  return elements.filter(e => e.groupId === groupId);
}

/**
 * Expand selection to include all group members.
 * If any selected element is in a group, add all group members.
 */
export function expandSelectionToGroups(selectedIds, elements) {
  const expanded = new Set(selectedIds);
  for (const id of selectedIds) {
    const el = elements.find(e => e.id === id);
    if (el && el.groupId) {
      for (const member of elements) {
        if (member.groupId === el.groupId) expanded.add(member.id);
      }
    }
  }
  return expanded;
}

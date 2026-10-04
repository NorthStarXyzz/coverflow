# CF-2026-10-04-local-interactions

- status: statistical_default, reviewable
- decided_by: statistical_default
- scope: Low-impact implementation choices for local UI
- patterns: F_fail_semantics

Selection is local and distinct from host-controlled playback. Item IDs are unique; invalid duplicate IDs or invalid dimensions throw before changing state. Reordering preserves the selected ID; removal chooses the nearest remaining item. Empty lists render an explicit empty state. No playback API calls originate in the library. Action callback failures go to onError; they do not mark media as playing. Superseded motion is interrupted by newer intent. Reduced motion follows the OS preference unless explicitly configured. Animation settles and schedules no permanent idle loop. Dispose removes listeners, observers, pending animation and owned DOM. These ordinary UI defaults are documented for downstream review.

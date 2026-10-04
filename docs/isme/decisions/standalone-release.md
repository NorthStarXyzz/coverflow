# CF-2026-10-04-standalone-release

- status: accepted
- decided_by: designer
- approval_source: The user explicitly requested a standalone local Cover Flow repository, completed development, and publication via GitHub CLI. This followed the proposed separation into a generic component, original styles/icons, synthetic artwork and retained MIT notices.
- patterns: D_external_dependency, F_fail_semantics, G_irreversible_action

Publish the generic component and demo, with no vendor client integrations, authentication, private source, extracted styles, copied icons or real album media. Data enters through documented item/state properties. Playback actions leave the component as callbacks; the host controls playback state. Public release occurs after code, package and UI verification. License project additions under MIT and retain notices for applicable MIT references.

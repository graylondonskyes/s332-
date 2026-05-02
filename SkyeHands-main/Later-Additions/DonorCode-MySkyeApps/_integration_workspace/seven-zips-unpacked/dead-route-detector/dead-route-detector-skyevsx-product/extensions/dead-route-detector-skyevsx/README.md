# Dead Route Detector - SkyeVSX

Dead Route Detector - SkyeVSX scans a workspace for controls and commands that look shipped but are not truly wired.

## It catches

- routes referenced by links, buttons, redirects, and menu objects that do not resolve
- declared routes that are never referenced internally
- command contributions with no registration
- executed commands with no matching contribution or registration
- placeholder controls such as `href="#"` and `javascript:void(0)`

## Commands

- Scan Workspace
- Open Report
- Export Report JSON
- Refresh Sidebar

## Notes

This build is dependency-free on purpose. It ships as a plain JavaScript extension source pack and can also be packed into a VSIX with the root packaging scripts in the parent product folder.

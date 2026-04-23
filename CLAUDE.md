## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- **Mobile First**: Explicitly define if a feature requires native modules or can be handled in the bridge (React Native/Flutter/Capacitor).
- If something goes sideways, STOP and re-plan immediately – don't keep pushing.
- Write detailed specs upfront to reduce ambiguity, especially regarding platform-specific behavior (iOS vs. Android).

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean.
- Offload research on native API documentation (Android/Apple Developer docs) to subagents.
- For complex UI animations or heavy data processing, use subagents to analyze performance impacts.
- One tack per subagent for focused execution.

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern.
- **Mobile Edge Cases**: Document platform-specific bugs (e.g., "Keyboard avoiding view on iOS") to prevent repeat mistakes.
- Ruthlessly iterate on these lessons until mistake rate drops.
- Review lessons at session start for relevant project.

### 4. Mobile Verification Protocol
- **Cross-Platform Check**: Never mark a task complete without confirming it works on BOTH Android and iOS.
- **Environment Check**: Verify changes in the Emulator/Simulator AND mention if a physical device test is required.
- Ask yourself: "Would a Senior Mobile Engineer approve this architecture?"
- Check logs (Logcat/Xcode console) and demonstrate correctness.

### 5. Demand Elegance (Mobile-Specific)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- **UX Consistency**: Ensure the solution respects platform-specific design patterns (Human Interface Guidelines vs. Material Design).
- Avoid "web-isms"—if a fix feels like a web hack, implement the elegant native-feeling solution.

### 6. Autonomous Mobile Debugging
- When given a bug report: just fix it. Don't ask for hand-holding.
- Resolve failing CI builds, CocoaPods issues, or Gradle sync errors autonomously.
- Point at logs, errors, failing tests – then resolve them.
- Zero context switching required from the user.

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items.
2. **Verify Plan**: Check in before starting implementation (especially for native bridge changes).
3. **Track Progress**: Mark items complete as you go.
4. **Explain Changes**: High-level summary at each step, noting any platform-specific tweaks.
5. **Document Results**: Add review section to `tasks/todo.md` including screenshots/gifs of UI if possible.
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections.

## Core Principles

- **Performance First**: Mobile hardware is varied. Minimize memory footprint and optimize rendering.
- **No Laziness**: Find root causes. No temporary "ignore" tags for TypeScript or Linting.
- **Offline-Ready**: Always consider how a feature behaves without a network connection.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid "scope creep" in native configuration files.

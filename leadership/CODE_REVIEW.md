# Code Review Guidelines

## Overview
Code reviews are essential for maintaining code quality, sharing knowledge, and catching issues before they reach production. This document outlines our team's approach to effective code reviews.

## Branch Structure
- **main**: Production-ready code only
- **staging**: Code ready for QA testing and staging environment
- **dev**: Development branch for feature integration

## Pull Request Requirements

### Approval Process
- **Minimum 2 approvals** required before any PR can be merged
- At least one approval must come from a senior developer or team lead
- The PR author cannot approve their own PR

### PR Naming Convention
Follow these formats for clear identification:
- `feature-XX`: New features (e.g., `feature-user-authentication`)
- `fix-XXX`: Bug fixes (e.g., `fix-login-validation-error`)
- `hotfix-XX`: Critical production fixes (e.g., `hotfix-payment-gateway`)
- `refactor-XX`: Refactor a feature (eg., `refactor-login-modal`)

### Draft and Work in Progress PRs
- **Open draft PRs early** to get feedback and share progress with the team
- Use GitHub/GitLab's built-in draft status when available
- For platforms without draft support, use `[WIP]` prefix in the title
- Example: `[WIP] feature-dashboard-redesign`
- **Reviewers can provide feedback on drafts** but should NOT approve until marked ready
- Move to "Ready for Review" only when no further commits are planned

### Required PR Information
Every PR must include:

1. **Clear Description**
   - What changes were made and why
   - Link to relevant tickets/issues
   - Any breaking changes or dependencies

2. **How to Test**
   - Step-by-step testing instructions
   - Required test data or setup
   - Screenshots/videos for UI changes

3. **Expected Behavior**
   - What should happen after the changes
   - Performance implications
   - Any new error cases or edge cases

4. **Documentation Updates**
   - README changes if needed
   - API documentation updates
   - Architecture diagrams if applicable

### Pre-Review Checklist (Author)
Before requesting reviews, perform a **self-code review**:
- [ ] **Self-review completed** - Review your own code first to catch trivial issues
- [ ] All merge conflicts resolved
- [ ] All tests passing locally
- [ ] Code follows team style guidelines
- [ ] No console.logs or debug code left behind
- [ ] Remove any commented-out code or TODO items
- [ ] Check for typos and formatting issues

## Review Process

### For Reviewers
- **Timely feedback is crucial** - Review PRs shortly after they come in if not in focused work
- **Maximum 1 business day** response time (ideally much faster)
- Focus on logic, security, performance, and maintainability
- Provide constructive feedback with examples and reasoning
- Ask questions if something isn't clear
- Test the changes locally for complex features
- **Can review draft PRs** for early feedback but don't approve until ready

### Review Checklist
- [ ] Code follows established patterns and conventions
- [ ] No obvious bugs or security issues
- [ ] Performance considerations addressed
- [ ] Error handling implemented appropriately
- [ ] Tests cover the new functionality
- [ ] Documentation is clear and complete

### Feedback Guidelines
- Be specific and actionable
- Explain the "why" behind suggestions
- Use prefixes: `MUST:` for required changes, `CONSIDER:` for suggestions
- Acknowledge good practices when you see them

## PR Lifecycle Stages

### 1. Draft Stage
- Open draft PRs **as early as possible** for early feedback and code sharing
- Team members can cherry-pick code even if incomplete
- Team Lead can detect implementation issues early
- Mark as draft until no further commits are planned

### 2. Ready for Review
- All required information in PR description
- Author assigns reviewers and updates project board
- PR is complete and ready for thorough review

### 3. In Review  
- Reviewers provide feedback
- Author addresses feedback with new commits
- For minor changes: keep status as "Ready for Review"
- For major changes: consider switching back to "Draft"

### 4. Merged
- Minimum approvals met
- All feedback addressed satisfactorily  
- Team has confidence in code quality and impact

## Emergency Procedures
For critical hotfixes:
- Can be merged with single approval from team lead
- Must be immediately cherry-picked to main if merged to hotfix branch
- Post-incident review required within 48 hours

## Why This Matters
Code reviews improve code quality, ensure best practices are followed, and help deliver required functionality reliably. When done efficiently, they boost team velocity rather than slow it down. 

Remember: Code reviews are about collaboration, not criticism. We're all working together to build better software.

## Merge Guidelines

### Timing and Efficiency
- **Merge PRs within 2-3 days** of creation for efficient cycle time
- Stale PRs become harder to merge and require tedious rebasing
- **Prioritize finishing in-progress work** over starting new work
- Only merge during business hours unless it's a critical hotfix

### Team Coordination
- **Use priority labels** on PRs to help reviewers focus on important work first
- For teams with many PRs, provide reviewers with prioritized review lists
- **Refocus team efforts on code review** if too many PRs are waiting

### Technical Process
- Use squash and merge for feature branches
- Use merge commits for release branches  
- Delete feature branches after merging

### Small vs Large Teams
- **Small teams (≤2 developers)**: Approvals must include other squad members + external reviewer
- **Large teams (>2 developers)**: Approvals must include Team Lead and/or senior teammate

## Communication Best Practices

### Reviewer Notification
- **GitHub/GitLab automatically notifies** assigned reviewers - no immediate Slack needed
- **Do notify on Slack when**:
  - No activity on PR after half-day or full-day
  - Urgent features or critical fixes need merging
  - PR has been waiting longer than expected

### Status Updates
- Move associated tickets/stories through project board columns:
  - Draft → In Progress  
  - Ready for Review → In Code Review
  - Merged → Ready for QA

### Priority Communication
- Use priority labels: `priority:high`, `priority:urgent`
- Share prioritized review lists in team channels when needed
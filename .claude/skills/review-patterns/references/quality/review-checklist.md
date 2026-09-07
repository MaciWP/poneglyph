# Review Checklist

Comprehensive checklist for code quality reviews, applicable to any language or framework.

## Naming (5 items)

- [ ] Functions use verbs describing action (getUserById, validateEmail)
- [ ] Variables use nouns describing content (userList, emailValidator)
- [ ] No single-letter names except loop counters (i, j, k)
- [ ] No abbreviations unless universal (id, url, api)
- [ ] Consistent naming style following project conventions

## Functions (6 items)

- [ ] Each function < 30 lines (ideal < 20)
- [ ] Each function < 4 parameters (use object param if more)
- [ ] Single responsibility (does one thing well)
- [ ] No side effects unless explicitly named (saveUser, updateCache)
- [ ] Early returns to reduce nesting
- [ ] Pure functions where possible (same input = same output)

## Classes/Modules (5 items)

- [ ] Each class/module < 200 lines
- [ ] Single responsibility (one reason to change)
- [ ] Cohesive methods (use instance state)
- [ ] Minimal public API (encapsulation)
- [ ] No God classes (doing too much)

## Files (5 items)

- [ ] Each file < 400 lines (ideal < 300)
- [ ] Single concept per file
- [ ] Imports organized (external, internal, types)
- [ ] No circular dependencies
- [ ] Related code colocated

## Error Handling (5 items)

- [ ] All async operations have proper error handling
- [ ] Error types are specific (not generic Error)
- [ ] Error messages are helpful (include context)
- [ ] Errors logged with stack trace
- [ ] Errors don't expose internal details to users

## Types / Contracts (5 items)

- [ ] All function parameters have clear types or contracts
- [ ] All return types are explicit
- [ ] No untyped escape hatches (avoid language-specific "any" equivalents)
- [ ] Use structured types for object shapes
- [ ] Use discriminated unions or enums for variants

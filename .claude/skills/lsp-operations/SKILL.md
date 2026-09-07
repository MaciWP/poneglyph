---
name: lsp-operations
description: |
  Referencia de operaciones LSP para navegación semántica de código y exploración con tipos.
  Úsala cuando: encontrar dónde se define una función, quién llama a un método, qué tipo devuelve, navegar a la implementación, listar símbolos de un fichero, "dónde se define", "quién llama a esto", "find references", "go to definition".
metadata:
  keywords: >
    Keywords - definition, references, hover, symbols, implementation, calls, lsp, go to,
    find usages, who calls, type info
disable-model-invocation: false
when_to_use: |
  "dónde se define", "quién llama a esto", "navega el código", "find references", "go to definition", "who calls this"
---

# LSP Operations Skill

Complete reference for Language Server Protocol operations for semantic code navigation.

## When to Use

| Task | LSP Operation | Why LSP |
|------|---------------|---------|
| Where is X defined? | `goToDefinition` | Type-aware, exact |
| Where is X used? | `findReferences` | Finds all usages |
| What type is X? | `hover` | Full signature |
| What functions in file? | `documentSymbol` | Complete list |
| Who calls this function? | `incomingCalls` | Call graph |
| What does this call? | `outgoingCalls` | Dependencies |
| Who implements interface? | `goToImplementation` | Polymorphism |

## Core Rules

| Priority | Tool | Use Case |
|----------|------|----------|
| 1 | **LSP** | Semantic navigation (type-aware) |
| 2 | Grep | Text search (fallback) |
| 3 | Glob | File search |

**Use LSP first** for TypeScript/JavaScript. Fall back to Grep only when LSP unavailable.

## Quick Reference

### Parameters (All Operations)

| Param | Type | Description |
|-------|------|-------------|
| `operation` | string | Operation name |
| `filePath` | string | Absolute or relative path |
| `line` | number | Line number (1-based) |
| `character` | number | Column (1-based) |

### LSP vs Grep

| Task | LSP | Grep |
|------|-----|------|
| Find definition | Exact location | May find wrong match |
| Find usages | Type-aware | False positives |
| Get signature | Complete types | Manual parsing |
| Implementations | Automatic | Impossible |
| Call hierarchy | Full graph | Not possible |

## Operations

### goToDefinition

**Purpose**: Navigate to where a symbol is defined

```
LSP({
  operation: 'goToDefinition',
  filePath: 'src/services/claude.ts',
  line: 50,
  character: 15
})
```

**Example**: "Where is ClaudeService defined?"

### findReferences

**Purpose**: Find all usages of a symbol

```
LSP({
  operation: 'findReferences',
  filePath: 'src/services/claude.ts',
  line: 50,
  character: 15
})
```

**Example**: "Where is executeStream used?"

### hover

**Purpose**: Get type information and documentation

```
LSP({
  operation: 'hover',
  filePath: 'src/services/claude.ts',
  line: 50,
  character: 15
})
```

**Example**: "What parameters does execute() accept?"

### documentSymbol

**Purpose**: List all symbols in a file

```
LSP({
  operation: 'documentSymbol',
  filePath: 'src/services/claude.ts',
  line: 1,
  character: 1
})
```

**Example**: "What functions are in claude.ts?"

### workspaceSymbol

**Purpose**: Search symbols across the project

```
LSP({
  operation: 'workspaceSymbol',
  filePath: 'src/services/claude.ts',
  line: 1,
  character: 1
})
```

**Example**: "Find all *Service classes"

### goToImplementation

**Purpose**: Find implementations of an interface

```
LSP({
  operation: 'goToImplementation',
  filePath: 'src/types/executor.ts',
  line: 10,
  character: 15
})
```

**Example**: "Who implements IExecutor?"

### prepareCallHierarchy

**Purpose**: Prepare for call hierarchy analysis

```
LSP({
  operation: 'prepareCallHierarchy',
  filePath: 'src/services/claude.ts',
  line: 100,
  character: 10
})
```

### incomingCalls

**Purpose**: Find what calls this function

```
LSP({
  operation: 'incomingCalls',
  filePath: 'src/services/claude.ts',
  line: 100,
  character: 10
})
```

**Example**: "What calls processMessage?"

### outgoingCalls

**Purpose**: Find what this function calls

```
LSP({
  operation: 'outgoingCalls',
  filePath: 'src/services/claude.ts',
  line: 100,
  character: 10
})
```

**Example**: "What does orchestrate() call?"

## Examples

### Find All Usages of a Type

```
// 1. First, find where type is defined
LSP({ operation: 'goToDefinition', filePath: 'src/api.ts', line: 15, character: 20 })

// 2. Then find all references
LSP({ operation: 'findReferences', filePath: 'src/types.ts', line: 5, character: 10 })
```

### Understand a Function's Dependencies

```
// 1. Get function signature
LSP({ operation: 'hover', filePath: 'src/service.ts', line: 50, character: 15 })

// 2. See what it calls
LSP({ operation: 'outgoingCalls', filePath: 'src/service.ts', line: 50, character: 15 })
```

### Parallel LSP Operations

```
// These can run in parallel (same message)
LSP({ operation: 'goToDefinition', filePath: 'file1.ts', line: 10, character: 5 })
LSP({ operation: 'findReferences', filePath: 'file2.ts', line: 20, character: 10 })
LSP({ operation: 'hover', filePath: 'file3.ts', line: 30, character: 15 })
```

## High-Value Files

Use `Glob` to discover project files before applying LSP operations. Each project will have different key files -- identify them at exploration time rather than relying on hardcoded paths.

## Checklist

### Before Using LSP

- [ ] File is TypeScript/JavaScript (LSP supported)
- [ ] Have exact file path
- [ ] Know line and column of symbol

### When to Fall Back to Grep

- [ ] LSP not available for language
- [ ] Searching text/comments (not code)
- [ ] Non-code files (markdown, json)

## Gotchas

| Gotcha | Why | Workaround |
|--------|-----|------------|
| LSP server takes time to initialize at session start (TypeScript server warmup) | Language server must parse and index the entire project first | First LSP call may fail or return empty; retry after a few seconds |
| Results are stale after Write/Edit (server hasn't reprocessed) | Language server reindexes asynchronously, not instantly | Re-run LSP operations after modifying files |
| Doesn't work on files without recognized extensions | LSP servers register for specific file types only | Fall back to Grep for config files, scripts without extensions |
| `findReferences` on a common name returns too many results | Generic names like `id`, `name`, `data` match everywhere | Narrow scope with file path or combine with Grep filter |
| `hover` on re-exported symbols may show the re-export, not the original definition | LSP resolves to the nearest declaration, which may be a re-export | Chain with `goToDefinition` to reach the actual implementation |

## Commandments cubiertos

| # | Cómo |
|---|---|
| II | Semantic resolution (definition/references/types) beats text-grep guesses for factual claims about code |
| I | Navigate and understand the call graph before acting on it |
| X | One LSP call replaces many speculative greps — fewer tokens, precise answers |

## Related

- `anti-hallucination` — the verification doctrine (LSP > Grep > Glob) this skill operationalizes.
- `review-patterns` / `diagnostic-patterns` — consumers that navigate code via these operations.

---

**Version**: 1.0.0

# Domain Templates

Pre-built templates for common task types.

## API Endpoint Template

```
Crear endpoint [METHOD] [PATH] que:
- Reciba: [request body/params con tipos]
- Valide: [reglas de validación]
- Retorne: [response shape + status codes]
- Errores: [casos de error esperados]
```

## Database Template

```
[Crear/Modificar] [tabla/query] para:
- Schema: [campos con tipos]
- Índices: [campos a indexar]
- Relaciones: [FKs si aplica]
- Migraciones: [up/down]
```

## Auth Template

```
Implementar [tipo de auth] con:
- Provider: [JWT/OAuth/Session]
- Storage: [cookie/localStorage/header]
- Expiración: [tiempo]
- Refresh: [estrategia]
```

## Testing Template

```
Tests para [componente/función]:
- Unit: [casos edge]
- Integration: [flujos]
- Mocks: [dependencias a mockear]
- Fixtures: [datos de prueba]
```

## Refactoring Template

```
Refactorizar [código target] para:
- Extraer: [funciones/clases]
- Patrón: [strategy/factory/etc]
- Mantener: [comportamiento a preservar]
- Tests: [cobertura existente]
```

## WebSocket Template

```
Implementar WebSocket [evento/canal] que:
- Conexión: [auth requerida?]
- Mensajes: [tipos de mensaje con schema]
- Broadcast: [a quién notificar]
- Errores: [reconexión, timeouts]
```

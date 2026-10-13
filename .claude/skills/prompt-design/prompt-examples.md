# Prompt Examples

Examples transforming vague prompts into actionable ones.

## Example 1: API

### Before (fails)
> "Hacer login"

### After (passes)
> "Crear endpoint POST /api/auth/login que:
> - Reciba { email: string, password: string }
> - Valide email formato válido, password min 8 chars
> - Compare password hasheado con bcrypt
> - Retorne 200 con { token: JWT, user: UserDTO } o 401"

## Example 2: Database

### Before (fails)
> "Agregar campo al usuario"

### After (passes)
> "Añadir campo `lastLoginAt: timestamp | null` a tabla users:
> - Migration up: ALTER TABLE ADD COLUMN
> - Migration down: ALTER TABLE DROP COLUMN  
> - Default: null para usuarios existentes
> - Índice: No requerido"

## Example 3: Refactoring

### Before (fails)
> "Limpiar el código"

### After (passes)
> "Refactorizar `processOrder()` en src/services/order.ts:
> - Extraer validación a `validateOrder()`
> - Extraer cálculo a `calculateTotal()`
> - Mantener firma pública igual
> - Tests existentes deben pasar"

## Example 4: Testing

### Before (fails)
> "Agregar tests"

### After (passes)
> "Añadir tests para `UserService.create()`:
> - Unit: email duplicado retorna error
> - Unit: password se hashea correctamente
> - Integration: usuario se guarda en DB
> - Mock: EmailService.sendWelcome()"

## Example 5: WebSocket

### Before (fails)
> "Hacer chat en tiempo real"

### After (passes)
> "Implementar WebSocket /ws/chat que:
> - Auth: JWT en query param `?token=`
> - Mensaje entrada: { type: 'message', content: string, roomId: string }
> - Broadcast: a todos los usuarios en el mismo roomId
> - Eventos: 'user_joined', 'user_left', 'message'"

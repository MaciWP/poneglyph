# Prompt Examples

Examples transforming vague prompts into actionable ones.

## Example 1: API

### Before (Score: 30)
> "Hacer login"

### After (Score: 85)
> "Crear endpoint POST /api/auth/login que:
> - Reciba { email: string, password: string }
> - Valide email formato válido, password min 8 chars
> - Compare password hasheado con bcrypt
> - Retorne 200 con { token: JWT, user: UserDTO } o 401"

## Example 2: Database

### Before (Score: 25)
> "Agregar campo al usuario"

### After (Score: 80)
> "Añadir campo `lastLoginAt: timestamp | null` a tabla users:
> - Migration up: ALTER TABLE ADD COLUMN
> - Migration down: ALTER TABLE DROP COLUMN  
> - Default: null para usuarios existentes
> - Índice: No requerido"

## Example 3: Refactoring

### Before (Score: 20)
> "Limpiar el código"

### After (Score: 85)
> "Refactorizar `processOrder()` en src/services/order.ts:
> - Extraer validación a `validateOrder()`
> - Extraer cálculo a `calculateTotal()`
> - Mantener firma pública igual
> - Tests existentes deben pasar"

## Example 4: Testing

### Before (Score: 35)
> "Agregar tests"

### After (Score: 80)
> "Añadir tests para `UserService.create()`:
> - Unit: email duplicado retorna error
> - Unit: password se hashea correctamente
> - Integration: usuario se guarda en DB
> - Mock: EmailService.sendWelcome()"

## Example 5: WebSocket

### Before (Score: 30)
> "Hacer chat en tiempo real"

### After (Score: 85)
> "Implementar WebSocket /ws/chat que:
> - Auth: JWT en query param `?token=`
> - Mensaje entrada: { type: 'message', content: string, roomId: string }
> - Broadcast: a todos los usuarios en el mismo roomId
> - Eventos: 'user_joined', 'user_left', 'message'"

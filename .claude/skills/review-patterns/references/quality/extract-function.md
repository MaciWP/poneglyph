# Extract Function Patterns

## Contents

- [When to Extract](#when-to-extract)
- [Pattern: Extract Calculation](#pattern-extract-calculation)
- [Pattern: Extract Conditional](#pattern-extract-conditional)

## When to Extract

- Function exceeds 20 lines
- Code block has a comment explaining "what it does"
- Same code appears in multiple places
- Complex conditional logic

## Pattern: Extract Calculation

```pseudocode
// BEFORE: Inline calculation logic
function processOrder(order):
    // Validate
    if order.items is empty:
        throw ValidationError("Order has no items")
    if not order.customerId:
        throw ValidationError("Order has no customer")

    // Calculate subtotal with discounts
    subtotal = 0
    for each item in order.items:
        itemTotal = item.price * item.quantity
        if item.discount:
            itemTotal -= item.discount
        if item.quantity >= 10:
            itemTotal *= 0.95  // 5% bulk discount
        subtotal += itemTotal

    // Apply tax
    taxRate = getTaxRate(order.shippingAddress.state)
    tax = subtotal * taxRate

    // Calculate shipping
    shipping = 0
    if subtotal < 100:
        shipping = 10
    else if subtotal < 200:
        shipping = 5

    total = subtotal + tax + shipping

    // Save and return
    savedOrder = database.orders.create(order + {subtotal, tax, shipping, total})
    return {order: savedOrder, total}


// AFTER: Extracted functions with single responsibility
function processOrder(order):
    validateOrder(order)

    subtotal = calculateSubtotal(order.items)
    tax = calculateTax(subtotal, order.shippingAddress.state)
    shipping = calculateShipping(subtotal)
    total = subtotal + tax + shipping

    savedOrder = saveOrder(order, {subtotal, tax, shipping, total})
    return {order: savedOrder, total}

function validateOrder(order):
    if order.items is empty:
        throw ValidationError("Order has no items")
    if not order.customerId:
        throw ValidationError("Order has no customer")

function calculateSubtotal(items) -> number:
    return sum(calculateItemTotal(item) for item in items)

function calculateItemTotal(item) -> number:
    baseTotal = item.price * item.quantity
    afterDiscount = baseTotal - (item.discount or 0)
    bulkMultiplier = 0.95 if item.quantity >= 10 else 1
    return afterDiscount * bulkMultiplier

function calculateTax(subtotal, state) -> number:
    taxRate = getTaxRate(state)
    return subtotal * taxRate

function calculateShipping(subtotal) -> number:
    if subtotal >= 200: return 0
    if subtotal >= 100: return 5
    return 10

function saveOrder(order, totals) -> SavedOrder:
    return database.orders.create(merge(order, totals))
```

## Pattern: Extract Conditional

```pseudocode
// BEFORE: Complex nested conditionals
function getAccessLevel(user, resource) -> AccessLevel:
    if user.role == "admin":
        return "full"
    else if user.role == "moderator":
        if resource.type == "post":
            return "full"
        else if resource.type == "user":
            return "read"
        else:
            return "none"
    else if user.role == "user":
        if resource.ownerId == user.id:
            return "full"
        else:
            return "read"
    return "none"

// AFTER: Extracted with early returns
function getAccessLevel(user, resource) -> AccessLevel:
    if isAdmin(user): return "full"
    if isModerator(user): return getModeratorAccess(resource)
    if isOwner(user, resource): return "full"
    return "read"

function isAdmin(user) -> boolean:
    return user.role == "admin"

function isModerator(user) -> boolean:
    return user.role == "moderator"

function isOwner(user, resource) -> boolean:
    return resource.ownerId == user.id

function getModeratorAccess(resource) -> AccessLevel:
    accessMap = {"post": "full", "user": "read"}
    return accessMap[resource.type] or "none"
```

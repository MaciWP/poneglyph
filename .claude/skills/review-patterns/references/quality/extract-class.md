# Extract Class Patterns

## Contents

- [When to Extract](#when-to-extract)
- [Pattern: Data + Behavior Cohesion](#pattern-data-behavior-cohesion)
- [Pattern: Extract Service](#pattern-extract-service)

## When to Extract

- Group of functions operate on same data
- Data and behavior should be encapsulated
- Single Responsibility Principle violation
- Test isolation needed

## Pattern: Data + Behavior Cohesion

```pseudocode
// BEFORE: Functions scattered, operating on User data
structure User:
    firstName, lastName, email, createdAt, lastLoginAt

function formatUserDisplayName(user) -> string:
    return user.firstName + " " + user.lastName

function isUserEmailVerified(user) -> boolean:
    return user.email contains "@" and user.lastLoginAt is not null

function getUserAccountAge(user) -> number:
    return now() - user.createdAt

function isUserActive(user) -> boolean:
    if user.lastLoginAt is null: return false
    daysSinceLogin = daysBetween(user.lastLoginAt, now())
    return daysSinceLogin < 30


// AFTER: Cohesive class
class UserPresenter:
    constructor(user):
        this.user = user

    property displayName -> string:
        return this.user.firstName + " " + this.user.lastName

    property isEmailVerified -> boolean:
        return this.user.email contains "@" and this.user.lastLoginAt is not null

    property accountAgeMs -> number:
        return now() - this.user.createdAt

    property isActive -> boolean:
        if this.user.lastLoginAt is null: return false
        daysSinceLogin = this.daysSince(this.user.lastLoginAt)
        return daysSinceLogin < 30

    private function daysSince(date) -> number:
        return daysBetween(date, now())

// Usage
presenter = new UserPresenter(user)
print(presenter.displayName)
print(presenter.isActive)
```

## Pattern: Extract Service

```pseudocode
// BEFORE: Route handler doing too much
route POST "/orders":
    handler(body, user):
        // Validation
        if body.items is empty: throw Error("No items")

        // Check inventory
        for each item in body.items:
            stock = database.inventory.find(item.productId)
            if stock.quantity < item.quantity:
                throw Error("Insufficient stock for " + item.productId)

        // Calculate totals
        total = 0
        for each item in body.items:
            product = database.products.find(item.productId)
            total += product.price * item.quantity

        // Create order
        order = database.orders.create({
            userId: user.id,
            items: body.items,
            total: total,
            status: "pending"
        })

        // Update inventory
        for each item in body.items:
            database.inventory.decrement(item.productId, item.quantity)

        // Send notification
        sendEmail(user.email, "Order Confirmation", "Order " + order.id)

        return order


// AFTER: Extracted service with single responsibility
class OrderService:
    constructor(inventoryService, notificationService):
        this.inventoryService = inventoryService
        this.notificationService = notificationService

    function createOrder(userId, items) -> Order:
        this.validateItems(items)
        this.inventoryService.reserveStock(items)

        total = this.calculateTotal(items)
        order = this.saveOrder(userId, items, total)

        this.inventoryService.commitReservation(items)
        this.notificationService.sendOrderConfirmation(userId, order)

        return order

    private function validateItems(items):
        if items is empty:
            throw ValidationError("Order must have items")

    private function calculateTotal(items) -> number:
        prices = parallel_map(items, item ->
            product = database.products.find(item.productId)
            return product.price * item.quantity
        )
        return sum(prices)

    private function saveOrder(userId, items, total) -> Order:
        return database.orders.create({
            userId, items, total, status: "pending"
        })


// Route becomes thin
route POST "/orders":
    handler(body, user):
        return orderService.createOrder(user.id, body.items)
```

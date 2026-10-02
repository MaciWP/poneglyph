# Common Issues

## Contents

- [Quick Smell Catalog](#quick-smell-catalog)
- [1. Long Method (> 20 lines)](#1-long-method-20-lines)
- [2. Long Parameter List (> 4 params)](#2-long-parameter-list-4-params)
- [3. Large Class (> 200 lines)](#3-large-class-200-lines)
- [4. Duplicated Code](#4-duplicated-code)
- [5. Feature Envy](#5-feature-envy)
- [6. Deep Nesting](#6-deep-nesting)
- [7. Magic Numbers/Strings](#7-magic-numbersstrings)
- [8. Parameter Object (Fix Pattern)](#8-parameter-object-fix-pattern)
- [9. Value Object (Fix Pattern)](#9-value-object-fix-pattern)

Code smell patterns with detection criteria and before/after examples.

## Quick Smell Catalog

| Smell | Detection | Fix | Example |
|-------|-----------|-----|---------|
| Long Method | > 20 lines | Extract Function | Split `calculateTotal()` |
| Large Class | > 200 lines | Extract Class | Split `UserManager` |
| Long Parameter List | > 4 params | Parameter Object | `CreateUserParams` |
| Duplicated Code | 2+ identical blocks | Extract Function | `validateEmail()` |
| Feature Envy | Uses other object's data | Move Method | Move to data owner |
| Data Clumps | Same params together | Extract Value Object | `Address`, `Money` |
| Primitive Obsession | Primitives for concepts | Value Object | `Email`, `UserId` |
| Switch Statements | Repeated type checks | Polymorphism | Strategy pattern |
| Shotgun Surgery | One change, many files | Move/Inline | Consolidate |

## 1. Long Method (> 20 lines)

**Problem**: Function does too many things, hard to understand and test.

**Detection**: Count lines, check for multiple responsibilities.

**BEFORE**:
```pseudocode
// BAD: 50+ lines doing multiple things
function processOrder(order):
    // Validation (10 lines)
    if order.items is empty:
        throw Error("Order must have items")
    if not order.customer:
        throw Error("Order must have customer")
    for each item in order.items:
        if not item.productId or not item.quantity:
            throw Error("Invalid item")

    // Calculation (15 lines)
    subtotal = 0
    for each item in order.items:
        product = database.products.find(item.productId)
        subtotal += product.price * item.quantity
    tax = subtotal * 0.1
    shipping = 0 if subtotal > 100 else 10
    total = subtotal + tax + shipping

    // Persistence (10 lines)
    savedOrder = database.orders.create(
        merge(order, {subtotal, tax, shipping, total, status: "pending"})
    )

    // Notification (10 lines)
    emailService.send({
        to: order.customer.email,
        subject: "Order Confirmation",
        body: "Your order #" + savedOrder.id + " has been received"
    })

    return savedOrder
```

**AFTER**:
```pseudocode
// GOOD: Single responsibility per function
function processOrder(order) -> SavedOrder:
    validateOrder(order)
    totals = calculateTotals(order)
    savedOrder = saveOrder(order, totals)
    notifyCustomer(savedOrder)
    return savedOrder

function validateOrder(order):
    if order.items is empty: throw ValidationError("Order must have items")
    if not order.customer: throw ValidationError("Order must have customer")
    for each item in order.items: validateItem(item)

function validateItem(item):
    if not item.productId or not item.quantity:
        throw ValidationError("Invalid item")

function calculateTotals(order) -> OrderTotals:
    subtotal = calculateSubtotal(order.items)
    tax = subtotal * TAX_RATE
    shipping = 0 if subtotal > FREE_SHIPPING_THRESHOLD else SHIPPING_COST
    return {subtotal, tax, shipping, total: subtotal + tax + shipping}
```

## 2. Long Parameter List (> 4 params)

**Problem**: Hard to use, easy to make mistakes with order.

**Detection**: Count function parameters.

**BEFORE**:
```pseudocode
// BAD: 6 parameters, order matters
function createUser(name, email, age, role, department, isActive):
    ...

// Easy to mix up parameters
createUser("John", "john@example.com", 30, "Engineering", "admin", true)
// Wrong order: role and department swapped!
```

**AFTER**:
```pseudocode
// GOOD: Parameter object with named properties
structure CreateUserParams:
    name, email, age, role, department, isActive (default: true)

function createUser(params: CreateUserParams) -> User:
    ...

// Clear and order doesn't matter
createUser({
    name: "John",
    email: "john@example.com",
    role: "admin",
    department: "Engineering",
    age: 30
})
```

## 3. Large Class (> 200 lines)

**Problem**: God class with too many responsibilities.

**Detection**: Count lines, check for unrelated methods.

**BEFORE**:
```pseudocode
// BAD: Class does everything
class UserService:
    // User CRUD (50 lines)
    createUser(), updateUser(), deleteUser(), getUser(), listUsers()

    // Validation (30 lines)
    validateEmail(), validatePassword(), validateUsername()

    // Email sending (40 lines)
    sendWelcomeEmail(), sendPasswordResetEmail(), sendNotificationEmail()

    // Reporting (30 lines)
    generateUserReport(), exportUsersToCSV()

    // Authentication (50 lines)
    login(), logout(), refreshToken()
```

**AFTER**:
```pseudocode
// GOOD: Split by responsibility
class UserService:
    constructor(userRepository, validator, emailService)

    function createUser(params) -> User:
        validator.validate(params)
        user = userRepository.create(params)
        emailService.sendWelcome(user)
        return user

class UserValidator:
    function validate(params) ...
    function validateEmail(email) ...
    function validatePassword(password) ...

class EmailService:
    function sendWelcome(user) ...
    function sendPasswordReset(user, token) ...

class UserReportService:
    function generate(filters) -> Report ...
    function exportToCSV(users) -> string ...
```

## 4. Duplicated Code

**Problem**: Same logic in multiple places, maintenance nightmare.

**Detection**: Similar code blocks, copy-paste patterns.

**BEFORE**:
```pseudocode
// BAD: Duplicated validation logic in 3 different files
// In user.service
function validateUserEmail(email) -> boolean:
    if not email: return false
    return email matches pattern "x@x.x"

// In signup.controller
function isValidEmail(email) -> boolean:
    if not email: return false
    return email matches pattern "x@x.x"

// In contact.service
function checkEmail(email) -> boolean:
    if not email: return false
    return email matches pattern "x@x.x"
```

**AFTER**:
```pseudocode
// GOOD: Single source of truth in shared utility
// In utils/validation
EMAIL_PATTERN = "x@x.x"

function isValidEmail(email) -> boolean:
    return email is not empty and email matches EMAIL_PATTERN

// Usage everywhere: import and call isValidEmail(email)
```

## 5. Feature Envy

**Problem**: Method uses another object's data more than its own.

**Detection**: Excessive property access on other objects (deep dot chains).

**BEFORE**:
```pseudocode
// BAD: OrderProcessor uses Order's internal data excessively
class OrderProcessor:
    function calculateTotal(order) -> number:
        total = 0

        // Accessing order.customer deeply
        discount = 0
        if order.customer.loyaltyPoints > 100:
            if order.customer.membershipLevel == "gold":
                discount = 0.15
            else:
                discount = 0.10

        // Accessing order.items deeply
        for each item in order.items:
            itemTotal = item.product.price * item.quantity
            itemDiscount = item.product.category.discountRate
            total += itemTotal * (1 - itemDiscount)

        // Accessing order.shipping deeply
        if order.shipping.method == "express":
            shippingCost = order.shipping.zone.expressRate
        else:
            shippingCost = order.shipping.zone.standardRate

        return total * (1 - discount) + shippingCost
```

**AFTER**:
```pseudocode
// GOOD: Move logic to where data lives
class Order:
    function calculateTotal() -> number:
        subtotal = this.calculateSubtotal()
        discount = this.customer.calculateDiscount()
        shipping = this.shipping.calculateCost()
        return subtotal * (1 - discount) + shipping

    private function calculateSubtotal() -> number:
        return sum(item.calculateTotal() for item in this.items)

class Customer:
    function calculateDiscount() -> number:
        if this.loyaltyPoints <= 100: return 0
        return 0.15 if this.membershipLevel == "gold" else 0.10

class OrderItem:
    function calculateTotal() -> number:
        basePrice = this.product.price * this.quantity
        return basePrice * (1 - this.product.category.discountRate)
```

## 6. Deep Nesting

**Problem**: Code with > 4 levels of indentation is hard to follow.

**Detection**: Count indentation levels.

**BEFORE**:
```pseudocode
// BAD: Deep nesting (5 levels)
function processUsers(users):
    if users:
        for each user in users:
            if user.isActive:
                if user.email:
                    if isValidEmail(user.email):
                        if user.role == "admin":
                            // Finally doing something...
                            sendAdminNotification(user)
```

**AFTER**:
```pseudocode
// GOOD: Early returns, extracted functions
function processUsers(users):
    if not users: return
    users
        .filter(isActiveAdminWithValidEmail)
        .forEach(sendAdminNotification)

function isActiveAdminWithValidEmail(user) -> boolean:
    return user.isActive
        and user.email is not empty
        and isValidEmail(user.email)
        and user.role == "admin"
```

## 7. Magic Numbers/Strings

**Problem**: Literal values without context.

**Detection**: Numbers or strings that aren't self-explanatory.

**BEFORE**:
```pseudocode
// BAD: What do these numbers mean?
if user.age >= 18 and user.score > 75:
    setTimeout(callback, 86400000)
    if status == "A":
        discount = 0.15
```

**AFTER**:
```pseudocode
// GOOD: Named constants with meaning
MINIMUM_AGE = 18
PASSING_SCORE = 75
ONE_DAY_MS = 24 * 60 * 60 * 1000

OrderStatus = {ACTIVE: "A", CANCELLED: "C", COMPLETED: "D"}

DISCOUNT_RATES = {STANDARD: 0.10, PREMIUM: 0.15, VIP: 0.20}

if user.age >= MINIMUM_AGE and user.score > PASSING_SCORE:
    setTimeout(callback, ONE_DAY_MS)
    if status == OrderStatus.ACTIVE:
        discount = DISCOUNT_RATES.PREMIUM
```

## 8. Parameter Object (Fix Pattern)

When multiple functions share the same group of parameters, extract them into a named structure.

**BEFORE**:
```pseudocode
// BAD: Long parameter list repeated across functions
function createUser(name, email, password, role, department, managerId, startDate) -> User ...
function updateUser(name, email, password, role, department, managerId, startDate) -> User ...
```

**AFTER**:
```pseudocode
// GOOD: Parameter object
structure CreateUserParams:
    name, email, password, role, department, managerId, startDate

function createUser(params: CreateUserParams) -> User:
    // destructure: name, email, password, etc. = params
    ...
```

## 9. Value Object (Fix Pattern)

When primitive types represent domain concepts, wrap them in value objects that enforce invariants.

**BEFORE**:
```pseudocode
// BAD: Primitive obsession - validation scattered everywhere
function sendEmail(to, from):
    if not to contains "@": throw Error("Invalid to")
    if not from contains "@": throw Error("Invalid from")
    ...
```

**AFTER**:
```pseudocode
// GOOD: Value object with validation at construction
class Email:
    constructor(email):
        if not email contains "@" or not email contains ".":
            throw ValidationError("Invalid email: " + email)
        this.value = lowercase(email)

    function toString() -> string:
        return this.value

    function equals(other: Email) -> boolean:
        return this.value == other.value

function sendEmail(to: Email, from: Email):
    // Validation already done by Email constructor
    ...
```

# SOLID Violations

## Contents

- [1. Single Responsibility Violation](#1-single-responsibility-violation)
- [2. Open/Closed Violation](#2-openclosed-violation)
- [3. Liskov Substitution Violation](#3-liskov-substitution-violation)
- [4. Interface Segregation Violation](#4-interface-segregation-violation)
- [5. Dependency Inversion Violation](#5-dependency-inversion-violation)

5 SOLID principle violations with detection, examples, and fixes.

## 1. Single Responsibility Violation

**Problem**: Class has multiple reasons to change.

**Detection**: Class contains methods spanning unrelated concerns (data access, email, validation, reporting).

```pseudocode
// BAD: Multiple responsibilities
class UserService:
    function createUser(data)      // data access
    function validateEmail(email)  // validation concern
    function sendWelcomeEmail(user) // email concern
    function generateUserReport()  // reporting concern
    function formatUserForAPI(user) // serialization concern

// GOOD: Single responsibility per class
class UserService:
    constructor(validator, emailService, repository)

    function createUser(data) -> User:
        validator.validateUserData(data)
        user = repository.create(data)
        emailService.sendWelcome(user)
        return user

class UserValidator:
    function validateUserData(data) ...
    function validateEmail(email) ...

class EmailService:
    function sendWelcome(user) ...
    function sendPasswordReset(user, token) ...

class UserReportService:
    function generateReport(userId) -> Report ...
```

## 2. Open/Closed Violation

**Problem**: Must modify existing code to add new behavior.

**Detection**: Growing switch/if-else chains that check types or categories.

```pseudocode
// BAD: Must modify for every new payment type
function processPayment(type, amount):
    switch type:
        case "credit": return processCreditCard(amount)
        case "paypal": return processPayPal(amount)
        case "crypto": return processCrypto(amount)
        // Must add case for every new type

// GOOD: Open for extension, closed for modification
interface PaymentProcessor:
    function process(amount) -> PaymentResult

class CreditCardProcessor implements PaymentProcessor:
    function process(amount) -> PaymentResult ...

class PayPalProcessor implements PaymentProcessor:
    function process(amount) -> PaymentResult ...

// Registry pattern - add new processors without modifying existing code
class PaymentRegistry:
    processors = map of (string -> PaymentProcessor)

    function register(type, processor):
        processors[type] = processor

    function process(type, amount) -> PaymentResult:
        processor = processors[type]
        if not processor: throw Error("Unknown payment type: " + type)
        return processor.process(amount)

// Adding a new type requires no modification to existing code
registry.register("crypto", new CryptoProcessor())
```

## 3. Liskov Substitution Violation

**Problem**: Subclass changes base class behavior in unexpected ways.

**Detection**: Overridden methods that throw exceptions, silently skip behavior, or change semantics.

```pseudocode
// BAD: Square violates Rectangle contract
class Rectangle:
    width, height

    function setWidth(w): this.width = w
    function setHeight(h): this.height = h
    function area() -> number: return this.width * this.height

class Square extends Rectangle:
    function setWidth(w):
        this.width = w
        this.height = w  // Unexpected side effect!
    function setHeight(h):
        this.width = h
        this.height = h  // Unexpected side effect!

// GOOD: Separate types implementing a common interface
interface Shape:
    function area() -> number

class Rectangle implements Shape:
    constructor(width, height)
    function area() -> number: return width * height

class Square implements Shape:
    constructor(side)
    function area() -> number: return side * side

// Both can be used wherever Shape is expected
function printArea(shape):
    print("Area: " + shape.area())
```

## 4. Interface Segregation Violation

**Problem**: Clients forced to implement methods they don't need.

**Detection**: Interfaces with methods that some implementations throw `NotImplemented` for, or leave as no-ops.

```pseudocode
// BAD: Fat interface
interface Worker:
    function work()
    function eat()
    function sleep()
    function attendMeeting()

class Robot implements Worker:
    function work() ...       // OK
    function eat(): throw Error("Robots do not eat")      // Violation!
    function sleep(): throw Error("Robots do not sleep")   // Violation!
    function attendMeeting() ...  // OK

// GOOD: Segregated interfaces
interface Workable:
    function work()

interface Feedable:
    function eat()

interface Restable:
    function sleep()

interface Meetable:
    function attendMeeting()

class Human implements Workable, Feedable, Restable, Meetable:
    function work() ...
    function eat() ...
    function sleep() ...
    function attendMeeting() ...

class Robot implements Workable, Meetable:
    function work() ...
    function attendMeeting() ...
    // No need to implement eat/sleep
```

## 5. Dependency Inversion Violation

**Problem**: High-level module depends on low-level implementation details.

**Detection**: Classes instantiating their own dependencies (using `new` for collaborators), making them impossible to swap or test.

```pseudocode
// BAD: Direct dependency on concrete implementations
class UserService:
    db = new PostgresDatabase()    // Tight coupling
    cache = new RedisCache()       // Can't swap implementations
    mailer = new SendGridMailer()  // Can't mock for tests

    function getUser(id) -> User:
        cached = cache.get("user:" + id)
        if cached: return cached
        return db.query("SELECT * FROM users WHERE id = ?", [id])

    function createUser(data) -> User:
        user = db.insert("users", data)
        mailer.send(user.email, "Welcome!")
        return user

// GOOD: Depend on abstractions, inject dependencies
interface Database:
    function query(sql, params) -> results
    function insert(table, data) -> record

interface Cache:
    function get(key) -> value or null
    function set(key, value, ttl)

interface Mailer:
    function send(to, subject, body)

class UserService:
    constructor(db: Database, cache: Cache, mailer: Mailer)

    function getUser(id) -> User:
        cached = cache.get("user:" + id)
        if cached: return cached
        user = db.query("SELECT * FROM users WHERE id = ?", [id])
        cache.set("user:" + id, user, 3600)
        return user

    function createUser(data) -> User:
        user = db.insert("users", data)
        mailer.send(user.email, "Welcome!", "Thanks for joining")
        return user

// Easy to swap implementations
productionService = new UserService(
    new PostgresDatabase(),  // or MongoDatabase
    new RedisCache(),        // or MemcachedCache
    new SendGridMailer()     // or MailgunMailer
)

// Easy to test with mocks
testService = new UserService(
    createMockDatabase(),
    createMockCache(),
    createMockMailer()
)
```

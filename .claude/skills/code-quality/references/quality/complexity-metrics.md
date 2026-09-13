# Complexity Metrics

## Contents

- [Cyclomatic Complexity](#cyclomatic-complexity)
- [Cognitive Complexity](#cognitive-complexity)

Cyclomatic and cognitive complexity measurement with examples.

## Cyclomatic Complexity

Count decision points: `if`, `else if`, `while`, `for`, `case`, `&&`, `||`, ternary operators.

| Complexity | Rating | Action |
|------------|--------|--------|
| 1-5 | Simple | OK |
| 6-10 | Moderate | Consider refactoring |
| 11-20 | Complex | Refactor required |
| > 20 | Very Complex | Split immediately |

### Example

**BEFORE** (Complexity: 12):
```pseudocode
function calculatePrice(product, user) -> number:
    price = product.basePrice

    if user.isPremium:                          // +1
        if user.yearsActive > 5:               // +1
            price *= 0.8
        else if user.yearsActive > 2:          // +1
            price *= 0.9

    if product.isOnSale:                       // +1
        price *= 0.85
    else if product.isClearance:               // +1
        price *= 0.7

    if user.hasVoucher and product.voucherEligible:  // +2 (and)
        price -= 10

    return max(price, 0)                       // +1 (ternary equivalent)
```

**AFTER** (Complexity: 3 per function):
```pseudocode
function calculatePrice(product, user) -> number:
    basePrice = product.basePrice
    userDiscount = getUserDiscount(user)
    productDiscount = getProductDiscount(product)
    voucherDiscount = getVoucherDiscount(user, product)

    finalPrice = basePrice * userDiscount * productDiscount - voucherDiscount
    return max(0, finalPrice)

function getUserDiscount(user) -> number:
    if not user.isPremium: return 1
    if user.yearsActive > 5: return 0.8
    if user.yearsActive > 2: return 0.9
    return 1

function getProductDiscount(product) -> number:
    if product.isOnSale: return 0.85
    if product.isClearance: return 0.7
    return 1

function getVoucherDiscount(user, product) -> number:
    return 10 if (user.hasVoucher and product.voucherEligible) else 0
```

## Cognitive Complexity

Measures how hard code is to understand. Nesting increases the penalty.

### Scoring Rules

| Construct | Base Penalty | Nesting Penalty |
|-----------|-------------|-----------------|
| `if`, `else if`, `else` | +1 | +1 per nesting level |
| `for`, `while`, `do` | +1 | +1 per nesting level |
| `catch` | +1 | +1 per nesting level |
| `switch` / `match` | +1 | +1 per nesting level |
| `and`, `or` (sequences) | +1 | none |
| `break`, `continue` to label | +1 | none |
| Recursion | +1 | none |

### Example

**BEFORE** (High cognitive load):
```pseudocode
function validate(data) -> ValidationResult:
    errors = []

    if data.type == "user":
        if data.email:
            if not isValidEmail(data.email):
                errors.add("Invalid email")
        else:
            errors.add("Email required")
        if data.age:
            if data.age < 0 or data.age > 150:
                errors.add("Invalid age")
    else if data.type == "company":
        if data.taxId:
            if not isValidTaxId(data.taxId):
                errors.add("Invalid tax ID")
        else:
            errors.add("Tax ID required")

    return {valid: errors is empty, errors}
```

**AFTER** (Low cognitive load):
```pseudocode
function validate(data) -> ValidationResult:
    validator = validators[data.type]
    if not validator:
        return {valid: false, errors: ["Unknown type"]}
    return validator(data)

validators = {
    "user": validateUser,
    "company": validateCompany
}

function validateUser(data) -> ValidationResult:
    errors = []

    if not data.email: errors.add("Email required")
    else if not isValidEmail(data.email): errors.add("Invalid email")

    if data.age and (data.age < 0 or data.age > 150):
        errors.add("Invalid age")

    return {valid: errors is empty, errors}
```

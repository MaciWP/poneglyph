# N+1 and Sequential Operation Patterns

## Contents

- [N+1 Query Problem](#n1-query-problem)
- [Synchronous Blocking](#synchronous-blocking)
- [Unbatched Operations](#unbatched-operations)
- [Sequential Await in Loop](#sequential-await-in-loop)
- [Unbounded Response Size](#unbounded-response-size)
- [Missing Indexes](#missing-indexes)
- [Missing Connection Pool](#missing-connection-pool)

Detailed patterns for detecting and fixing N+1 queries, synchronous blocking, unbatched operations, and sequential await anti-patterns.

## N+1 Query Problem

**Problem**: Executing N additional queries for N items.

**Impact**: O(n) queries instead of O(1), exponential slowdown.

**Detection**: Query in a loop, lazy loading in iteration.

**BEFORE** (slow):
```pseudocode
// N+1 queries — 1 for users, N for posts
users = database.query("SELECT * FROM users")
FOR EACH user IN users:
    user.posts = database.query("SELECT * FROM posts WHERE user_id = ?", [user.id])
// 101 queries for 100 users!
```

**AFTER** (fast):
```pseudocode
// Option A: Single query with JOIN
usersWithPosts = database.query(
    "SELECT * FROM users LEFT JOIN posts ON users.id = posts.user_id"
)

// Option B: Two queries with batch loading
userList = database.query("SELECT * FROM users")
userIds = userList.map(u => u.id)
allPosts = database.query("SELECT * FROM posts WHERE user_id IN (?)", [userIds])

// Group posts by userId
postsByUser = groupBy(allPosts, "userId")
FOR EACH user IN userList:
    user.posts = postsByUser[user.id] OR []
// Only 2 queries regardless of user count!
```

## Synchronous Blocking

**Problem**: Synchronous I/O blocks the main thread / event loop.

**Impact**: All concurrent requests wait, throughput drops to 1.

**Detection**: Any synchronous file, network, or database call in a request handler.

**BEFORE** (slow):
```pseudocode
// Blocks entire server while reading file
ENDPOINT GET /file:
    data = readFileSync("large-file.json")
    RETURN parseJSON(data)
```

**AFTER** (fast):
```pseudocode
// Async file read — other requests can proceed during I/O
ENDPOINT GET /file:
    data = AWAIT readFileAsync("large-file.json")
    RETURN parseJSON(data)
```

## Unbatched Operations

**Problem**: Individual database operations instead of batch.

**Impact**: N round trips instead of 1, network overhead.

**Detection**: Insert/update in loop.

**BEFORE** (slow):
```pseudocode
// 1000 individual inserts
FOR EACH item IN items:
    AWAIT database.insert("products", item)
// 1000 database round trips!
```

**AFTER** (fast):
```pseudocode
// Single batch insert
AWAIT database.batchInsert("products", items)
// 1 database round trip!

// For very large batches, chunk it
BATCH_SIZE = 1000
FOR i FROM 0 TO length(items) STEP BATCH_SIZE:
    chunk = items[i : i + BATCH_SIZE]
    AWAIT database.batchInsert("products", chunk)
```

## Sequential Await in Loop

**Problem**: Awaiting sequentially when operations are independent.

**Impact**: Total time = sum of all operations instead of max.

**Detection**: Await inside for/forEach/map loop.

**BEFORE** (slow):
```pseudocode
// Sequential — takes 10 seconds for 10 items (1s each)
results = []
FOR EACH url IN urls:
    response = AWAIT httpGet(url)         // 1 second each
    results.append(response.body)
```

**AFTER** (fast):
```pseudocode
// Parallel — takes 1 second for 10 items
results = AWAIT parallelAll(
    FOR EACH url IN urls:
        httpGet(url).then(response => response.body)
)

// With concurrency limit for rate-limited APIs
results = AWAIT parallelAll(
    FOR EACH url IN urls:
        withConcurrencyLimit(5, () => httpGet(url))
)
```

## Unbounded Response Size

**Problem**: Returning all records without pagination.

**Impact**: Memory exhaustion, timeout, slow response.

**Detection**: List endpoint without LIMIT.

**BEFORE** (slow):
```pseudocode
// Returns all records — could be millions of rows
ENDPOINT GET /api/users:
    RETURN database.query("SELECT * FROM users")
```

**AFTER** (fast):
```pseudocode
// Paginated with validation
ENDPOINT GET /api/users:
    page = max(1, query.page OR 1)
    limit = clamp(query.limit OR 20, min=1, max=100)

    data, countResult = AWAIT parallel(
        database.query("SELECT * FROM users LIMIT ? OFFSET ?", [limit, (page-1)*limit]),
        database.query("SELECT count(*) FROM users")
    )

    RETURN {
        data: data,
        pagination: {
            page: page,
            limit: limit,
            total: countResult,
            pages: ceil(countResult / limit)
        }
    }
```

## Missing Indexes

**Problem**: Queries perform full table scans.

**Impact**: O(n) instead of O(log n) lookups.

**Detection**: Slow queries, high CPU during queries.

**BEFORE** (slow):
```pseudocode
// No index on email column — full table scan on every login
database.query("SELECT * FROM users WHERE email = ?", [email])
```

**AFTER** (fast):
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

Define indexes in your ORM schema alongside table definitions (syntax varies by ORM).

## Missing Connection Pool

**Problem**: Creating new database connections per request.

**Impact**: Connection exhaustion, slow connection setup.

**Detection**: No pool configuration, connection errors under load.

**BEFORE** (slow):
```pseudocode
// New connection each request — expensive setup every time
ENDPOINT GET /data:
    connection = database.createConnection(connectionString)
    AWAIT connection.open()
    result = AWAIT connection.query("SELECT * FROM data")
    connection.close()
    RETURN result
```

**AFTER** (fast):
```pseudocode
// Connection pool — reuse connections across requests
pool = database.createPool(connectionString,
    maxConnections=20,
    idleTimeout=20s,
    connectTimeout=10s
)

ENDPOINT GET /data:
    RETURN AWAIT pool.query("SELECT * FROM data")
    // Connection automatically returned to pool
```

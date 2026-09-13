# Memory Leak Patterns

## Contents

- [Growing Collections (Unbounded Cache)](#growing-collections-unbounded-cache)
- [Event Listener Leak](#event-listener-leak)
- [Large Object Serialization](#large-object-serialization)
- [Memory Management Checklist](#memory-management-checklist)

Detection and fix patterns for memory leaks, event listener leaks, and large object serialization issues.

## Growing Collections (Unbounded Cache)

**Problem**: Collections grow without bounds.

**Impact**: Memory exhaustion, OOM crash, GC pauses.

**Detection**: Maps/dictionaries/lists without cleanup, module-level state.

**BEFORE** (leaks):
```pseudocode
// Unbounded cache — grows forever
cache = new Map()

ENDPOINT GET /data/{id}:
    IF NOT cache.has(id):
        cache.set(id, AWAIT fetchData(id))
    RETURN cache.get(id)
// Cache grows forever — no eviction!
```

**AFTER** (bounded):
```pseudocode
// LRU cache with size limit and TTL
cache = new LRUCache(
    maxEntries=1000,
    ttl=5 minutes
)

ENDPOINT GET /data/{id}:
    data = cache.get(id)
    IF data IS NULL:
        data = AWAIT fetchData(id)
        cache.set(id, data)
    RETURN data
```

## Event Listener Leak

**Problem**: Adding event listeners without removing them.

**Impact**: Memory leak, duplicate handlers.

**Detection**: Listener added without corresponding removal.

**BEFORE** (leaks):
```pseudocode
// Listener added on every request — never removed!
ENDPOINT GET /stream:
    emitter.on("data", handleData)
    RETURN stream
```

**AFTER** (clean):
```pseudocode
// Proper cleanup when stream closes
ENDPOINT GET /stream:
    handler = (data) => handleData(data)
    emitter.on("data", handler)

    RETURN createStream(
        onClose: () => emitter.off("data", handler)
    )
```

## Large Object Serialization

**Problem**: Serializing large objects blocks CPU.

**Impact**: Main thread blocked, all requests delayed.

**Detection**: Large objects in response, slow endpoint.

**BEFORE** (slow):
```pseudocode
// Serialize entire dataset at once — blocks CPU for large data
ENDPOINT GET /export:
    allData = AWAIT database.query("SELECT * FROM data")
    RETURN serialize(allData)  // Blocks for large datasets
```

**AFTER** (fast):
```pseudocode
// Stream large responses — process one row at a time
ENDPOINT GET /export:
    stream = createResponseStream()
    stream.write("[")
    first = true

    FOR EACH row IN database.streamQuery("SELECT * FROM data"):
        IF NOT first:
            stream.write(",")
        stream.write(serialize(row))
        first = false

    stream.write("]")
    stream.close()
    RETURN stream
```

## Memory Management Checklist

| Pattern | Detection | Fix |
|---------|-----------|-----|
| Unbounded Map/Dict | Module-level Map without eviction | Use LRU cache with maxEntries + TTL |
| Event listeners | `.on()` without `.off()` | Remove listener on cleanup/close |
| Intervals/timeouts | `setInterval` without `clearInterval` | Clear on shutdown/disconnect |
| Closures holding references | Large objects captured in closures | Null out references after use |
| Weak references not used | Object-keyed caches holding strong refs | Use WeakMap/WeakRef when available |
| Large buffers | Accumulating buffers without draining | Stream processing instead of buffering |

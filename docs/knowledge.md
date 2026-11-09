# Python concept: `lru_cache`

In `app/config.py`, this line:

```python
from functools import lru_cache
```

imports `lru_cache` from Python's built-in `functools` module. Importing it
makes it available in this file, but does not cache anything on its own.

## What caching means

A cache is a place to remember a result. When a function is called again with
the same arguments, Python can return the remembered result instead of running
the function again.

`lru_cache` is a decorator. A decorator is written with `@` above a function
and adds behavior to that function:

```python
from functools import lru_cache

@lru_cache
def get_settings():
    print("Loading settings")
    return {"region": "us-east-1"}
```

The first call to `get_settings()` runs the function and prints
`Loading settings`. Later calls reuse the remembered result, so the function
does not print again.

## Why use it for settings?

An application often needs its configuration in many places. A cached
`get_settings()` function can load the settings once and return the same
settings object whenever it is called. This avoids repeating the setup work.

The import alone does not mean this is happening: the function must actually
be defined and decorated with `@lru_cache`.

`LRU` means “Least Recently Used.” When a cache has a size limit and fills up,
the least recently used entry is the one that can be removed to make room.
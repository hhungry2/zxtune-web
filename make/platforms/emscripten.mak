# output is a javascript es6 module plus the wasm payload next to it
makebin_name = $(1).mjs
makelib_name = lib$(1).a
makedyn_name = $(1).mjs
makeobj_name = $(1).o

host=linux
compiler=clang

# emscripten driver is clang-based, but keeps its own tool names
tools.cxx = em++
tools.cc = emcc
tools.ld = em++
tools.ar = emar

# wasm-ld knows nothing about build-id, archive groups are not required,
# final binary is postprocessed by emcc itself, so no objcopy stage
BUILD_ID_FLAG =
LINKER_BEGIN_GROUP =
LINKER_END_GROUP =
postlink_cmd = true

# -g is unconditionally added by compilers/clang.mak, dwarf in wasm costs tens of megabytes
emscripten.cxx.flags += -g0

# there is 12x realtime of headroom in the worst measured case, so trade speed for
# size: -Oz costs 16-24% of render throughput and takes 23% off the wasm
emscripten.cxx.flags += -Oz -fno-unroll-loops

# core reports all the errors via exceptions, so this is mandatory, not optional.
# wasm sjlj is implied by wasm exceptions and is required by several 3rdparty c libraries
emscripten.cxx.flags += -fwasm-exceptions
emscripten.ld.flags += -fwasm-exceptions -sSUPPORT_LONGJMP=wasm

# no dynamic linking, heap is grown on demand, parsing of deeply nested containers needs the stack
emscripten.ld.flags += -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=1MB

# matches makebin_name above- the result is imported, not executed
emscripten.ld.flags += -sMODULARIZE=1 -sEXPORT_ES6=1

ifdef release
emscripten.ld.flags += -Oz
endif

# libc++ bounded iterators make fmt-9 compile-time format string check non-constexpr,
# so format strings are validated at runtime here
defines.emscripten += FMT_CONSTEVAL=

# wasm is always little-endian, no gettext, no logging to nowhere
defines.emscripten += __LITTLE_ENDIAN__ LITTLE_ENDIAN NO_DEBUG_LOGS NO_L10N

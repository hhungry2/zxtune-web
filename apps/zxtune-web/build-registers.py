"""Incrementally build this checkout with an existing emsdk/object cache (WSL)."""
from pathlib import Path
import shlex
import subprocess

workspace = Path(__file__).resolve().parents[2]
cache = Path.home() / 'zxtune-web'
out = workspace / 'bin/emscripten/release'
out.mkdir(parents=True, exist_ok=True)


def commands(cwd, forced):
    args = ['make', '-n', 'platform=emscripten']
    for file in forced:
        args += ['-W', str(file)]
    return subprocess.check_output(args, cwd=cwd, text=True).splitlines()


def compile_args(line):
    args = shlex.split(line)
    if '-c' in args:
        args[1:1] = ['-I' + str(workspace / 'src'), '-I' + str(workspace / 'include')]
        args = [str(workspace / Path(arg).relative_to(cache))
                if arg.startswith(str(cache) + '/') and arg.endswith('.cpp') else arg for arg in args]
    return args


core = cache / 'src/module/players'
count = 0
for line in commands(core, [core / 'aym/aym_base.cpp', core / 'aym/ayemul.cpp']):
    if line.startswith(('em++ ', 'emar ')):
        subprocess.run(compile_args(line), cwd=core, check=True)
        count += 1
assert count == 3, count

build = cache / 'apps/zxtune-web'
count = 0
for line in commands(build, [build / 'zxtune.cpp']):
    if not line.startswith('em++ '):
        continue
    replacements = {
        '../../obj/emscripten/release/zxtune/zxtune.cpp.o': str(out / 'state-binding.o'),
        '../../bin/emscripten/release/zxtune.mjs': str(out / 'zxtune.mjs'),
    }
    args = [replacements.get(arg, arg) for arg in compile_args(line)]
    subprocess.run(args, cwd=build, check=True)
    count += 1
assert count == 2, count
print('AY register engine build complete')

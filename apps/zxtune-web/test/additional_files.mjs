// Round trip for multi-file formats: a module reports the sibling files it needs,
// they get handed back, the requirement clears.
//
// The xsf family keeps the bulk of a rip in a shared library file and ships one
// small file per track referencing it with a `_lib` tag. Real rips are game music,
// so the fixtures here are synthesized: a PSF container with no program section
// and nothing but that tag, which is enough to exercise enumerate and resolve.
//
//   node apps/zxtune-web/test/additional_files.mjs
import { crc32 } from 'node:zlib';
import createZXTune from '../../../bin/emscripten/release/zxtune.mjs';

// "PSF", version, le32 reserved size, le32 program size, le32 crc32(program),
// then [reserved][program], then "[TAG]" and one name=value per line.
function psf(version, tags) {
  const head = Buffer.alloc(3 + 1 + 4 + 4 + 4);
  head.write('PSF', 0, 'ascii');
  head.writeUInt8(version, 3);
  head.writeUInt32LE(0, 4);
  head.writeUInt32LE(0, 8);
  head.writeUInt32LE(crc32(Buffer.alloc(0)), 12);
  return new Uint8Array(Buffer.concat([head, Buffer.from('[TAG]' + tags.map(t => t + '\n').join(''), 'utf8')]));
}

const VERSIONS = { psf: 0x01, psf2: 0x02, ssf: 0x11, dsf: 0x12, usf: 0x21, gsf: 0x22, '2sf': 0x24, ncsf: 0x25 };

const zxtune = await createZXTune();

const put = bytes => {
  const at = zxtune._malloc(bytes.length);
  zxtune.HEAPU8.set(bytes, at);
  return at;
};
const toArray = vector => [...Array(vector.length).keys()].map(i => vector[i]);

let failures = 0;
for (const [kind, version] of Object.entries(VERSIONS)) {
  const wanted = `base.${kind}lib`;
  const bytes = psf(version, [`_lib=${wanted}`, 'title=lib probe']);

  let track;
  const at = put(bytes);
  try {
    track = zxtune.load(at, bytes.length, '');
  } catch (e) {
    console.log(`${kind.padEnd(5)} FAIL  load: ${zxtune.getExceptionMessage?.(e)?.at(-1) ?? e}`);
    ++failures;
    continue;
  } finally {
    zxtune._free(at);
  }

  const before = toArray(track.getAdditionalFiles());
  const lib = put(bytes);
  let resolved = true;
  try {
    track.resolveAdditionalFile(wanted, lib, bytes.length);
  } catch (e) {
    resolved = false;
    console.log(`${kind.padEnd(5)} FAIL  resolve: ${zxtune.getExceptionMessage?.(e)?.at(-1) ?? e}`);
  } finally {
    zxtune._free(lib);
  }
  const after = toArray(track.getAdditionalFiles());
  track.delete();

  const ok = before.length === 1 && before[0] === wanted && resolved && after.length === 0;
  if (!ok) ++failures;
  console.log(`${kind.padEnd(5)} ${ok ? 'ok  ' : 'FAIL'}  needs ${JSON.stringify(before)} -> resolved -> ${JSON.stringify(after)}`);
}

// A self-contained module must report nothing and refuse a resolve.
{
  const plain = psf(0x01, ['title=no lib here']);
  const at = put(plain);
  let ok = false;
  try {
    const track = zxtune.load(at, plain.length, '');
    const needs = toArray(track.getAdditionalFiles());
    let refused = false;
    try {
      track.resolveAdditionalFile('whatever', at, plain.length);
    } catch {
      refused = true;
    }
    track.delete();
    ok = needs.length === 0 && refused;
  } catch (e) {
    console.log(`plain FAIL  load: ${zxtune.getExceptionMessage?.(e)?.at(-1) ?? e}`);
  } finally {
    zxtune._free(at);
  }
  if (!ok) ++failures;
  console.log(`plain ${ok ? 'ok  ' : 'FAIL'}  needs [] and refuses a resolve`);
}

// A gsf with neither a program section nor a library is malformed. It used to
// dereference the missing section and trap the whole wasm instance; it has to
// come back as a catchable error instead.
{
  const broken = psf(0x22, ['title=no program, no lib']);
  const at = put(broken);
  let ok = false;
  try {
    zxtune.load(at, broken.length, '').delete();
    console.log('broken FAIL  malformed gsf loaded');
  } catch (e) {
    ok = typeof (zxtune.getExceptionMessage?.(e)?.at(-1) ?? '') === 'string';
  } finally {
    zxtune._free(at);
  }
  if (!ok) ++failures;
  console.log(`broken ${ok ? 'ok ' : 'FAIL'}  malformed gsf throws instead of trapping`);
}

console.log(failures ? `${failures} failure(s)` : 'all ok');
process.exit(failures ? 1 : 0);

// 테마 묶음을 쓰고 읽는 가장 작은 zip 도구다(`theme-cli.mjs`의 `theme:pack`이 쓴다). 새 의존성을 더하지 않으려고 직접 쓴다.
// 같은 파일 목록은 늘 같은 바이트가 된다(시간은 1980-01-01, 순서는 경로순). 폴더 항목, 암호, 여러 디스크, zip64는 다루지 않는다.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const UTF8_NAMES = 0x0800;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
/** 읽기 전용 일반 파일(0644)이라는 표시. 압축을 풀 때 실행 권한이 붙지 않는다. */
const UNIX_FILE = (0o100644 << 16) >>> 0;

/**
 * @param {{ path: string, data: Buffer }[]} entries `path`는 `/`로 나눈 상대 경로
 * @returns {Buffer}
 */
export function createZip(entries) {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { path, data } of sorted) {
    const name = Buffer.from(path, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const method = stored ? 0 : 8;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_NAMES, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(UNIX_FILE, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * `createZip`이 만든 zip(과 같은 모양의 zip)을 읽는다. 시험과 묶은 뒤 확인에 쓰는 것이라 낯선 zip을 믿고 풀 용도가 아니다.
 * @param {Buffer} zip
 * @returns {{ path: string, data: Buffer }[]}
 */
export function readZip(zip) {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== END) end -= 1;
  if (end < 0) throw new Error('zip의 끝 표시를 찾을 수 없어요.');
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== CENTRAL) throw new Error('zip의 목록이 깨졌어요.');
    const method = zip.readUInt16LE(at + 10);
    const crc = zip.readUInt32LE(at + 16);
    const packed = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const path = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(start, start + packed);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    if (crc32(data) !== crc) throw new Error(`${path}의 내용이 깨졌어요.`);
    entries.push({ path, data: Buffer.from(data) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

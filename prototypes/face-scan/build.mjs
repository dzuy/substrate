import { cp, mkdir } from 'node:fs/promises';
await mkdir(new URL('../../dist/face-scan-prototype/', import.meta.url), { recursive: true });
await cp(new URL('./public/', import.meta.url), new URL('../../dist/face-scan-prototype/', import.meta.url), { recursive: true });
console.log('Copied isolated Face Scan Lab to dist/face-scan-prototype');

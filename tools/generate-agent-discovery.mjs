import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.');
const publicRoot = path.join(root, 'public');
const skillRelative = 'ai/skills/site-lookup/SKILL.md';
const skillBytes = await readFile(path.join(publicRoot, skillRelative));
const digest = createHash('sha256').update(skillBytes).digest('hex');
const index = {
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [{
    name: 'site-lookup',
    type: 'skill-md',
    description: 'Retrieve and explain the real public pages of MP3 MIDI Tool through its bounded read-only lookup service.',
    url: 'https://mp3miditool.com/ai/skills/site-lookup/SKILL.md',
    digest: `sha256:${digest}`,
  }],
};
const indexPath = path.join(publicRoot, '.well-known', 'agent-skills');
await mkdir(indexPath, { recursive: true });
await writeFile(path.join(indexPath, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(JSON.stringify({ skill: skillRelative, bytes: skillBytes.byteLength, digest }, null, 2));

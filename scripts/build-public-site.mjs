import { copyFile, lstat, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const outputDirectory = path.resolve(repositoryRoot, process.argv[2] ?? '.vercel-public');
const filesystemRoot = path.parse(outputDirectory).root;

if (
  outputDirectory === filesystemRoot
  || outputDirectory === repositoryRoot
  || repositoryRoot.startsWith(`${outputDirectory}${path.sep}`)
) {
  throw new Error(`Refusing unsafe public output directory: ${outputDirectory}`);
}

const manifestPath = path.join(repositoryRoot, 'public-release.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(manifest) || manifest.length === 0 || !manifest.every((entry) => typeof entry === 'string')) {
  throw new Error('public-release.json must be a non-empty array of file paths');
}

const normalized = manifest.map((entry) => path.posix.normalize(entry));
if (
  new Set(normalized).size !== normalized.length
  || normalized.some((entry) => entry.startsWith('../') || entry.startsWith('/') || entry === '.')
  || normalized.some((entry, index) => entry !== manifest[index])
) {
  throw new Error('public-release.json contains a duplicate or unsafe path');
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const relativePath of normalized) {
  const sourcePath = path.resolve(repositoryRoot, relativePath);
  if (!sourcePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error(`Release input escapes repository root: ${relativePath}`);
  }
  const sourceStat = await lstat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error(`Release input must be a regular file: ${relativePath}`);
  }
  const resolvedSource = await realpath(sourcePath);
  if (!resolvedSource.startsWith(`${repositoryRoot}${path.sep}`)) {
    throw new Error(`Release input resolves outside repository root: ${relativePath}`);
  }
  const destinationPath = path.join(outputDirectory, relativePath);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

process.stdout.write(`Built ${normalized.length} public files in ${outputDirectory}\n`);

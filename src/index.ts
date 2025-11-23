import * as os   from "os";
import * as fs   from "fs";
import * as path from "path";
import * as core   from "@actions/core";
import * as exec   from "@actions/exec";
import * as github from "@actions/github";


// TYPES
// Publish options.
interface PublishOptions {
  denoConfig: string;
  manifest: string;
  npmrc: string;
  npmignore: string;
  registry: string;
  registryToken: string;
  registryUrl?: string;
}


// Manifest options.
interface ManifestOptions {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  license: string;
  author: string;
}


// GLOBALS
const E = process.env;
// const GITHUB_HEADERS = {
//   'Accept': 'application/vnd.github.v3+json',
//   'X-GitHub-Api-Version': '2022-11-28'
// };


// FUNCTIONS
// Read a text file and normalize line endings to LF.
function readTextFileSync(pth: string): string {
  if (!fs.existsSync(pth)) return "";
  var txt = fs.readFileSync(pth, "utf8");
  return txt.replace(/\r\n?/g, "\n");
}


// Write a text file and normalize line endings to the current OS.
function writeTextFileSync(pth: string, txt: string): void {
  txt = txt.replace(/\r\n?|\n/g, os.EOL);
  fs.writeFileSync(pth, txt);
}


// Read a JSON file.
function readJsonFileSync(pth: string): any {
  return JSON.parse(readTextFileSync(pth) || "{}");
}


// Write a JSON file.
function writeJsonFileSync(pth: string, obj: any): void {
  writeTextFileSync(pth, JSON.stringify(obj, null, 2));
}


// Execute a shell command.
async function execCommand(cmd: string, args?: string[], cwd?: string) {
  let stdout = "";
  let stderr = "";
  await exec.exec(cmd, args || [], {
    listeners: {
      stdout: (data: Buffer) => (stdout += data.toString()),
      stderr: (data: Buffer) => (stderr += data.toString()),
    },
    cwd: cwd || process.cwd(),
  });
  return { stdout, stderr };
}


/**
 * Perform a GitHub API request.
 * @param command The GitHub API command (e.g., "repos/owner/repo").
 * @returns parsed response
 */
// async function fetchGithubApi(command: string) {
//   const url = `https://api.github.com/${command}`;
//   const headers = {...GITHUB_HEADERS};
//   if (E.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${E.GITHUB_TOKEN}`;
//   const res = await fetch(url, {method: 'GET', headers});
//   if (!res.ok) throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);
//   return await res.json();
// }


// Fetch a JSR package as an NPM package, using JSR's NPM compatibility layer.
async function fetchPackageNpm(pkg: string, cwd: string) {
  const manifestPath = path.join(cwd, 'package.json');
  const npmrcPath = path.join(cwd, '.npmrc');
  core.info(`Fetching ${pkg} ...`);
  const [, scope, name, ver] = /@(.+)\/(.+)(?:@(.+))/.exec(pkg);
  const npmPkg = `@jsr/${scope}__${name}` + (ver ? `@${ver}` : "");
  fs.rmSync(npmrcPath, { recursive: true, force: true });
  fs.rmSync(manifestPath, { recursive: true, force: true });
  writeTextFileSync(npmrcPath, `@jsr:registry=https://npm.jsr.io/\n`);
  await execCommand('npm', ['install', npmPkg], cwd);
  return readTextFileSync(manifestPath);
}


// Publish package to NPM.
async function publishPackageNpm(pub: PublishOptions, man: ManifestOptions, cwd: string) {
  const manifestPath  = path.join(cwd, 'package.json');
  const npmrcPath     = path.join(cwd, '.npmrc');
  const npmignorePath = path.join(cwd, '.npmignore');
  const registryUrl   = pub.registryUrl || "registry.npmjs.org";
  const d = JSON.parse(pub.denoConfig || "{}");
  const m = JSON.parse(pub.manifest || "{}");
  // Merge deno.json and package.json contents.
  Object.assign(d, m);
  if (!m.imports) d.imports = undefined;
  if (!m.exports) d.exports = undefined;
  // Fill in manifest fields from inputs.
  d.name        = d.name        || man.name;
  d.version     = d.version     || man.version;
  d.description = d.description || man.description;
  d.keywords    = d.keywords    || man.keywords;
  d.license     = d.license     || man.license;
  d.author      = d.author      || man.author;
  // Fetch missing fields from GitHub API.
  if (!d.keywords || !d.author) {
    const ctx     = github.context;
    const octokit = github.getOctokit(E.GITHUB_TOKEN || "");
    const { owner, repo } = ctx.repo;
    const res  = await octokit.rest.repos.get({ owner, repo });
    d.keywords = d.keywords || res.data.topics.join(",");
    d.author   = d.author   || res.data.owner.email || res.data.owner.login;
  }
  writeJsonFileSync(manifestPath, d);
  const npmPkg = `${d.name}@${d.version}`;
  core.info(`Publishing ${npmPkg} to NPM (${pub.registryUrl}) ...`);
  let npmrc = pub.npmrc;
  npmrc = npmrc.trim() + "\n";
  npmrc = npmrc.replace(/^\s*registry=\S+/g, "");
  npmrc = npmrc.replace(/^\s*\/\/\S+/g, "");
  npmrc += `//${registryUrl.replace(/^https?:\/\//, "")}/:_authToken=${pub.registryToken}\n`;
  writeTextFileSync(npmrcPath, npmrc);
  let npmignore = pub.npmignore;
  npmignore = npmignore.trim() + "\n";
  npmignore += "deno.json\n";
  npmignore += "deno.jsonc\n";
  npmignore += "deno.lock\n";
  writeTextFileSync(npmignorePath, npmignore);
  await execCommand('npm', ['publish'], cwd);
  return readTextFileSync(manifestPath);
}


// Mirror a JSR package to NPM.
async function mirrorPackageNpm() {
  const denoConfigPath = core.getInput("deno-config-path") || "deno.json";
  const registry       = core.getInput("registry") || "npm";
  const registryToken  = core.getInput("registry-token") || "";
  const registryUrl    = core.getInput("registry-url") || "";
  const manifestPath   = core.getInput("manifest-path") || "package.json";
  const npmrcPath      = core.getInput("npmrc-path") || ".npmrc";
  const npmignorePath  = core.getInput("npmignore-path") || ".npmignore";
  const name        = core.getInput("name") || "";
  const version     = core.getInput("version") || "";
  const description = core.getInput("description") || "";
  const keywords    = core.getInput("keywords") || "";
  const license     = core.getInput("license") || "";
  const author      = core.getInput("author") || "";
  const cwd         = fs.mkdtempSync("jsr-mirror-");
  const denoConfig  = readTextFileSync(denoConfigPath);
  const manifest    = readTextFileSync(manifestPath);
  const npmrc       = readTextFileSync(npmrcPath);
  const npmignore   = readTextFileSync(npmignorePath);
  const pub: PublishOptions = {
    denoConfig,
    manifest,
    npmrc,
    npmignore,
    registry,
    registryToken,
    registryUrl,
  };
  const man: ManifestOptions = {
    name,
    version,
    description,
    keywords: keywords.split(",").map(k => k.trim()),
    license,
    author,
  };
  const deno = JSON.parse(denoConfig || "{}");
  const pkg  = `${deno.name}@${deno.version}`;
  await fetchPackageNpm(pkg, cwd);
  await publishPackageNpm(pub, man, cwd);
  fs.rmSync(cwd, { recursive: true, force: true });
  core.info(`Published ${pkg} to NPM.`);
}


// Main function.
async function main() {
  const registry = core.getInput("registry");
  switch (registry) {
    default: throw new Error(`Unknown registry: ${registry}`); break;
    case "npm": await mirrorPackageNpm(); break;
  }
}
main();

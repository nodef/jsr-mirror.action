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
  githubToken?: string;
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
// const E = process.env;
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
  const [, scope, name, ver] = /@(.+)\/(.+)(?:@(.+))/.exec(pkg);
  const npmPkg = `@jsr/${scope}__${name}` + (ver ? `@${ver}` : "");
  fs.rmSync(npmrcPath, { recursive: true, force: true });
  fs.rmSync(manifestPath, { recursive: true, force: true });
  core.info(`Setting up .npmrc for JSR registry ...`);
  const npmrc = `@jsr:registry=https://npm.jsr.io/\n`;
  writeTextFileSync(npmrcPath, npmrc);
  core.info(`Contents of .npmrc:\n${npmrc}`);
  core.info(`Fetching ${pkg} ...`);
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
  if (d.publish) d.publish = undefined;
  if (d.imports) d.imports = undefined;
  if (d.exports) d.exports = undefined;
  Object.assign(d, m);
  // Fill in manifest fields from inputs.
  d.name        = man.name        || d.name;
  d.version     = man.version     || d.version;
  d.description = man.description || d.description;
  d.keywords    = man.keywords    || d.keywords;
  d.license     = man.license     || d.license;
  d.author      = man.author      || d.author;
  // Fetch missing fields from GitHub API.
  if ((!d.keywords || !d.author) && pub.githubToken) {
    try {
      const ctx     = github.context;
      const octokit = github.getOctokit(pub.githubToken);
      const { owner, repo } = ctx.repo;
      const res  = await octokit.rest.repos.get({ owner, repo });
      d.keywords = d.keywords || res.data.topics.join(",");
      d.author   = d.author   || res.data.owner.email || res.data.owner.login;
    }
    catch (e) { core.warning(`Failed to fetch data from GitHub API: ${e.message}`); }
  }
  core.info(`Setting up package.json ...`);
  writeJsonFileSync(manifestPath, d);
  core.info(`Contents of package.json:\n${JSON.stringify(d, null, 2)}`);
  const npmPkg = `${d.name}@${d.version}`;
  let npmrc = pub.npmrc;
  npmrc = npmrc.trim() + "\n";
  npmrc = npmrc.replace(/^\s*registry=\S+/g, "");
  npmrc = npmrc.replace(/^\s*\/\/\S+/g, "");
  npmrc += `//${registryUrl.replace(/^https?:\/\//, "")}/:_authToken=${pub.registryToken}\n`;
  npmrc = npmrc.trim() + "\n";
  core.info(`Setting up .npmrc ...`);
  writeTextFileSync(npmrcPath, npmrc);
  core.info(`Contents of .npmrc:\n${npmrc}`);
  let npmignore = pub.npmignore;
  npmignore = npmignore.trim() + "\n";
  npmignore += "deno.json\n";
  npmignore += "deno.jsonc\n";
  npmignore += "deno.lock\n";
  npmignore = npmignore.trim() + "\n";
  core.info(`Setting up .npmignore ...`);
  writeTextFileSync(npmignorePath, npmignore);
  core.info(`Contents of .npmignore:\n${npmignore}`);
  core.info(`Publishing ${npmPkg} to NPM (${registryUrl}) ...`);
  await execCommand('npm', ['publish'], cwd);
  return readTextFileSync(manifestPath);
}


// Mirror a JSR package to NPM.
async function mirrorPackageNpm() {
  const denoConfigPath = core.getInput("deno-config-path") || "deno.json";
  const registry       = core.getInput("registry") || "npm";
  const registryToken  = core.getInput("registry-token") || "";
  const registryUrl    = core.getInput("registry-url") || "";
  const githubToken    = core.getInput("github-token") || "";
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
  if (registryToken.length < 4) throw new Error("Registry token is required for publishing.");
  const pub: PublishOptions = {
    denoConfig,
    manifest,
    npmrc,
    npmignore,
    registry,
    registryToken,
    registryUrl,
    githubToken,
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

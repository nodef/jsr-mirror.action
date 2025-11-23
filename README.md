A GitHub Action for mirroring JavaScript Registry ([JSR]) packages to other registries.

> [!NOTE]
> As of now, this action only supports mirroring to [npm]. \
> The aim is to support other registries in the future.

[JSR]: https://jsr.io
[npm]: https://www.npmjs.com

<br>


### Examples

```yaml
# Mirror this JSR package to NPM.
- uses: nodef/jsr-mirror.action@v1.0.0
  with:
    registry: 'npm'
    registry-token: ${{ secrets.NPM_TOKEN }}
```

```yaml
# Mirror the JSR package, with a different name.
- uses: nodef/jsr-mirror.action@v1.0.0
  with:
    registry: 'npm'
    registry-token: ${{ secrets.NPM_TOKEN }}
    name: 'my-npm-package'
    version: '1.0.0'
    description: 'My package description'
    keywords: 'keyword1,keyword2'
    author: 'Mr. Mime'
```

```yaml
# Mirror the JSR package to GitHub Packages.
- uses: nodef/jsr-mirror.action@v1.0.0
  with:
    registry: 'npm'
    registry-token: ${{ secrets.GITHUB_TOKEN }}
    registry-url: 'https://npm.pkg.github.com'
```

```yaml
# Mirror the JSR package using custom manifest, npmrc, and npmignore files.
- uses: nodef/jsr-mirror.action@v1.0.0
  with:
    registry: 'npm'
    registry-token: ${{ secrets.NPM_TOKEN }}
    manifest-path: 'package.json'
    npmrc-path: '.npmrc'
    npmignore-path: '.npmignore'
```

<br>


### Usage

```yaml
- uses: nodef/jsr-mirror.action@v1.0.0
  with:
    registry: 'npm'                             # Target registry to mirror the JSR package to (REQUIRED)
    registry-token: ${{ secrets.NPM_TOKEN }}    # Token needed to publish to the target registry (REQUIRED)
    registry-url: 'https://npm.pkg.github.com'  # URL of the target registry
    deno-config-path: 'deno.json'               # Path to the Deno config file
    manifest-path: 'package.json'               # Path to the manifest file
    npmrc-path: '.npmrc'                        # Path to the npmrc file
    npmignore-path: '.npmignore'                # Path to the npmignore file
    name: 'mypackage'                      # Name of the package in the target registry
    version: '1.0.0'                       # Version of the package in the target registry
    description: 'My package description'  # Description of the package in the target registry
    keywords: 'keyword1,keyword2'          # Keywords of the package in the target registry
    license: 'MIT'                         # License of the package in the target registry
    author: 'My Name'                      # Author of the package in the target registry
```

<br>
<br>


## References

- [ryoppippi/mirror-jsr-to-npm: a tool designed to mirror packages from JSR to NPM; ryoppippi (2024)](https://github.com/ryoppippi/mirror-jsr-to-npm)
- [npm compatibility - Docs - JSR](https://jsr.io/docs/npm-compatibility)

<br>

![](https://ga-beacon.deno.dev/G-RC63DPBH3P:SH3Eq-NoQ9mwgYeHWxu7cw/github.com/nodef/jsr-mirror.action)

# Publish Extensions to Open VSX

[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)

A CI script for publishing open-source VS Code extensions to [open-vsx.org](https://open-vsx.org).

## When to Add an Extension?

A goal of Open VSX is to have extension maintainers publish their extensions [according to the documentation](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions). The first step we recommend is to open an issue with the extension owner. If the extension owner is unresponsive for some time, this repo (publish-extensions) can be used **as a temporary workaround** to ensure the extension is published to Open VSX.

In the long-run it is better for extension owners to publish their own plugins because:

1. Any future issues (features/bugs) with any published extensions in Open VSX will be directed to their original repo/source-control, and not confused with this repo `publish-extensions`.
1. Extensions published by official authors are shown within the Open VSX marketplace as such. Whereas extensions published via publish-extensions display a warning that the publisher (this repository) is not the official author.
1. Extension owners who publish their own extensions get greater flexibility on the publishing/release process, therefore ensure more accuracy/stability. For instance, in some cases publish-extensions has build steps within this repository, which can cause some uploaded plugin versions to break (e.g. if a plugin build step changes).

⚠️ We only accept extensions with an [OSI-approved open source license](https://opensource.org/licenses) here. If you want to have an extension with a proprietary or non-approved license published, please ask its maintainers to publish it.

## How to Add an Extension?

To add an extension to this repo, add it to the [`extensions.json`](./extensions.json) file. You can do this directly via GitHub using its web editor, or for a way simpler approach, which makes sure your extension also goes in the right place in the file, clone the repo, install the dependencies, and use the following command:

```bash
node add-extension.js ext.id https://github.com/x/y --optional arg
```

Or, if the extension you want to add exists on the MS Marketplace[^ms], you can simply feed the script the item URL (this automatically populates both the ID and git repository).

```bash
node add-extension.js https://marketplace.visualstudio.com/items?itemName=ext.id --optional arg
```

All of the arguments are also valid options if you add the extension manually to the JSON file directly. You can find them in the [extension-schema.json file](https://github.com/open-vsx/publish-extensions/blob/HEAD/extensions-schema.json).

See [Publishing options](#publishing-options) below for a quick guide.

⚠️ Some extensions require additional build steps, and failing to execute them may lead to a broken extension published to Open VSX. Please check the extension's `scripts` section in the package.json file to find such steps; usually they are named `build` or similar. In case the build steps are included in the [vscode:prepublish](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#prepublish-step) script, they are executed automatically, so it's not necessary to mention them explicitly. Otherwise, please include them in the `prepublish` value, e.g. `"prepublish": "npm run build"`.

Click the button below to start a [Gitpod](https://gitpod.io) workspace where you can run the scripts contained in this repository:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/open-vsx/publish-extensions)

## Publishing Options

The best way to add an extension here is to [open this repository in Gitpod](https://gitpod.io/#https://github.com/open-vsx/publish-extensions) and [add a new entry to `extensions.json`](#how-to-add-an-extension).

To test, run:
```
GITHUB_TOKEN=your_pat EXTENSIONS=rebornix.ruby SKIP_PUBLISH=true node publish-extensions.js
```

### `GITHUB_TOKEN`
For testing locally, we advise you to provide a [GitHub Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for release and file resolution in our scripts. Otherwise, publishing can work in our workflow but fail for you locally and vice-a-versa.

You can create one in your [GitHub Token Settings](https://github.com/settings/tokens). This token does not require any special permissions.

```jsonc
    // Unique Open VSX extension ID in the form "<publisher>.<name>"
    "rebornix.ruby": {
      // Repository URL to clone and publish from. If the extension publishes `.vsix` files as release artifacts, this will determine the repo to fetch the releases from.
      "repository": "https://github.com/redhat-developer/vscode-yaml"
    },
```

## How do extensions get updated?

The publishing job auto infers the latest version published to the MS Marketplace[^ms] using [`vsce`](https://www.npmjs.com/package/vsce) and then tries to resolve a `vsix` file using a [GitHub Release asset](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) or, when one doesn't exist, it tries to find a commit to a build associated with the version using tags and commits around the last MS Marketplace[^ms] updated date.

## How are Extensions Published?

Every night (Monday-Friday) at [03:03 UTC](https://github.com/open-vsx/publish-extensions/blob/a95d871811e490e1d24fd233b4047cac03f293a2/.github/workflows/publish-extensions.yml#L6), a [GitHub Actions workflow](https://github.com/open-vsx/publish-extensions/blob/a95d871811e490e1d24fd233b4047cac03f293a2/.github/workflows/publish-extensions.yml#L25-L68) goes through all entries in [`extensions.json`](./extensions.json), and checks for every entry whether it needs to be published to https://open-vsx.org or not (whether it is up-to-date).

The [publishing process](https://github.com/open-vsx/publish-extensions/blob/master/publish-extension.js) can be summarized like this:

1. [`git clone "repository"`](https://github.com/open-vsx/publish-extensions/blob/a0fa4378a6621fb4d660a3bc7cefe71e074c077f/lib/resolveExtension.js#L53)

If a `custom` property is provided, then every command from the array is executed. Otherwise, the following 2 steps are executed: (steps 4 and 5 are executed in both cases)

2. [`npm install`](https://github.com/open-vsx/publish-extensions/blob/a0fa4378a6621fb4d660a3bc7cefe71e074c077f/publish-extension.js#L56) (or `yarn install` if a `yarn.lock` file is detected in the repository)
3. _([`"prepublish"`](https://github.com/open-vsx/publish-extensions/blob/fcf903b3a3d7df1c7f7bc7ce20f21b8a9d49e5d4/publish-extension.js#L79))_
4. _([`ovsx create-namespace "publisher"`](https://github.com/open-vsx/publish-extensions/blob/fcf903b3a3d7df1c7f7bc7ce20f21b8a9d49e5d4/publish-extension.js#L135-L140) if it doesn't already exist)_
5. [`ovsx publish`](https://github.com/open-vsx/publish-extensions/blob/fcf903b3a3d7df1c7f7bc7ce20f21b8a9d49e5d4/publish-extension.js#L142) (with `--yarn` if a `yarn.lock` file was detected earlier)

See all `ovsx` CLI options [here](https://github.com/eclipse/openvsx/blob/master/cli/README.md).

## Environment Variables
Custom commands such as `prepublish` and the ones inside the `custom`-array receive a few environment variables
in order to perform advanced tasks such as executing operations based on the extension version.

Following environment variables are available:
  - `EXTENSION_ID`: the extension ID, e.g. `rebornix.ruby`
  - `EXTENSION_PUBLISHER`: the extension publisher, e.g. `rebornix`
  - `EXTENSION_NAME`: the extension name, e.g. `ruby`
  - `VERSION`: the version of the extension to publish, e.g. `0.1.0`
  - `MS_VERSION`: the latest version of the extension on the MS Marketplace[^ms], e.g. `0.1.0`
  - `OVSX_VERSION`: the latest version of the extension on Open VSX, e.g. `0.1.0`

[publish-extensions-job]: https://github.com/open-vsx/publish-extensions/blob/master/.github/workflows/publish-extensions.yml

[^ms]: [The Microsoft Visual Studio Code Extensions Marketplace](https://marketplace.visualstudio.com/)
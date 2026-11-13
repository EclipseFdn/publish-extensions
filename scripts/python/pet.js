// Build and stage Python Environment Tools for extension packages.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repository = "https://github.com/microsoft/python-environment-tools.git";

function prepare() {
    const extension = JSON.parse(process.env.EXTENSION);
    const runners = {
        "x86_64-pc-windows-msvc": "windows-latest",
        "aarch64-pc-windows-msvc": "windows-latest",
        "x86_64-apple-darwin": "macos-15-intel",
        "aarch64-apple-darwin": "macos-15",
        "x86_64-unknown-linux-musl": "ubuntu-latest",
        "aarch64-unknown-linux-gnu": "ubuntu-24.04-arm",
        "armv7-unknown-linux-gnueabihf": "ubuntu-latest",
    };
    const targets = [
        ...new Set(
            Object.values(extension.target || {})
                .map((value) => value.env?.CARGO_TARGET)
                .filter(Boolean),
        ),
    ];
    const include = targets.map((target) => {
        if (!Object.hasOwn(runners, target)) throw new Error(`Unsupported PET target: ${target}`);
        return { target, runner: runners[target] };
    });
    console.log(`matrix=${JSON.stringify({ include })}`);
    console.log(`needs_pet=${include.length > 0}`);
    if (include.length) {
        const ref = execFileSync("git", ["ls-remote", repository, "HEAD"], { encoding: "utf8" }).split(/\s+/)[0];
        if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error("Could not resolve PET HEAD");
        console.log(`pet_ref=${ref}`);
    }
}

const target = process.env.CARGO_TARGET;
if (process.argv[2] !== "prepare" && (!target || !/^[a-z0-9_-]+$/.test(target))) {
    throw new Error("CARGO_TARGET is required");
}
const artifacts = process.env.PET_ARTIFACTS_DIR || path.join(os.tmpdir(), "pet-artifacts");
const artifact = path.join(artifacts, `pet-${target}`);
const binary = target?.includes("windows") ? "pet.exe" : "pet";
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: "inherit" });

function build() {
    const checkout = fs.mkdtempSync(path.join(os.tmpdir(), "pet-source-"));
    run("git", ["clone", repository, checkout]);
    if (process.env.PET_REF) run("git", ["checkout", "--detach", process.env.PET_REF], checkout);
    fs.copyFileSync(path.join(checkout, ".cargo/config.toml.disabled"), path.join(checkout, ".cargo/config.toml"));
    run("rustup", ["target", "add", target], checkout);
    const cross = target === "armv7-unknown-linux-gnueabihf";
    run(
        cross ? "cross" : "cargo",
        ["build", "--locked", "--release", "--package", "pet", "--target", target],
        checkout,
    );
    fs.mkdirSync(artifact, { recursive: true });
    fs.copyFileSync(path.join(checkout, "target", target, "release", binary), path.join(artifact, binary));
    for (const name of ["LICENSE", "NOTICE", "NOTICE.txt", "ThirdPartyNotices.txt"]) {
        const source = path.join(checkout, name);
        if (fs.existsSync(source)) fs.copyFileSync(source, path.join(artifact, name));
    }
}

if (process.argv[2] === "prepare") {
    prepare();
} else if (process.argv[2] === "build") {
    build();
} else if (process.argv[2] === "stage") {
    if (!fs.existsSync(path.join(artifact, binary))) {
        if (process.env.CI) throw new Error(`Missing PET artifact for ${target}`);
        build();
    }
    const destination = path.join(process.cwd(), "python-env-tools");
    fs.mkdirSync(path.join(destination, "bin"), { recursive: true });
    fs.copyFileSync(path.join(artifact, binary), path.join(destination, "bin", binary));
    if (binary === "pet") fs.chmodSync(path.join(destination, "bin", binary), 0o755);
    for (const name of fs.readdirSync(artifact)) {
        if (name !== binary) fs.copyFileSync(path.join(artifact, name), path.join(destination, name));
    }
} else {
    throw new Error("Expected prepare, build, or stage");
}

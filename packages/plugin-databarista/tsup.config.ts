import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    dts: true,
    splitting: false,
    bundle: true,
    skipNodeModulesBundle: true,
    noExternal: ["dkg.js"],
    external: [
        "@elizaos/core",
        "dotenv",
        "fs",
        "path",
        "@reflink/reflink",
        "@node-llama-cpp",
        "https",
        "http",
        "agentkeepalive",
        "ethers",
        "assertion-tools",
        "ws",
        "net",
        "tls",
        "crypto",
        "events",
        "stream",
        "util",
        "url",
        "zlib"
    ],
    esbuildOptions(options) {
        options.banner = {
            js: `import { createRequire as __createRequire } from 'module';const require = __createRequire(import.meta.url);`,
        };
        options.platform = 'node';
        options.target = 'node16';
    }
});

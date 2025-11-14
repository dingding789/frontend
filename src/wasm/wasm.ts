import MainModuleFactory, { MainModule } from "./chili-wasm";

declare global {
    var wasm: MainModule;
}

export async function initWasm() {
    globalThis.wasm = await MainModuleFactory();
    return globalThis.wasm;
}

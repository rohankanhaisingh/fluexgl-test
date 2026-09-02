import { DspPipeline } from "@fluex/fluexgl-dsp";

const pipeline = new DspPipeline({
    pathToWasm: "./bin/fluexgl-dsp-wasm_bg.wasm",
    pathToWorklet: "./bin/fluexgl-dsp-processor.worklet"
});

await pipeline.initializeDpsPipeline();
import { DspPipeline, LoadAudioSource, AudioClip } from "@fluex/fluexgl-dsp";

(async function () {

    const pipeline = new DspPipeline({
        pathToWasm: "/bin/fluexgl-dsp-wasm_bg.wasm",
        pathToWorklet: "/bin/fluexgl-dsp-processor.worklet",
        options: {
            overrideMaxAudioBufferNodes: true
        }
    });

    await pipeline.InitializeDpsPipeline();

    const audioDevice = await pipeline.ResolveDefaultAudioOutputDevice();

    if (!audioDevice) return;

    const master = audioDevice.GetMasterChannel();
    const audioSource = await LoadAudioSource("/sounds/War FX Gun Shot 005.wav");

    if (!audioSource) return;

    const channel = audioDevice.CreateChannel();
    channel.Send(master);


})()
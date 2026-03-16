import { AudioClip, Channel, DspPipeline, LoadAudioSource } from "@fluex/fluexgl-dsp";

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

    const channel1 = audioDevice.CreateChannel();
    const channel2 = audioDevice.CreateChannel();

    const soundData = await LoadAudioSource("/sounds/War FX Gun Shot 005.wav");

    if (!soundData) return;

    const audioClip = new AudioClip(soundData);

    audioClip.Send(channel1);
    audioClip.Send(channel2);

    channel1.Send(master);
    channel2.Send(master);

    channel1.Pan(-1);
    channel2.Pan(1);

    window.addEventListener("click", function () {
        audioClip.Play();
    });

})();
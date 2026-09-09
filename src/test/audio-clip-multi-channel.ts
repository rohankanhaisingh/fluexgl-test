import { AudioClip, DspPipeline, loadAudioSource } from "@fluex/fluexgl-dsp";

(async function () {

    const pipeline = new DspPipeline({
        pathToWasm: "/bin/fluexgl-dsp-wasm_bg.wasm",
        pathToWorklet: "/bin/fluexgl-dsp-processor.worklet",
        options: {
            overrideMaxAudioBufferNodes: true
        }
    });

    await pipeline.initializeDpsPipeline();

    const audioDevice = await pipeline.resolveDefaultAudioOutputDevice();

    if (!audioDevice) return;

    const master = audioDevice.getMasterChannel();

    const channel1 = audioDevice.createChannel();
    const channel2 = audioDevice.createChannel();

    const soundData = await loadAudioSource("/sounds/War FX Gun Shot 005.wav");

    if (!soundData) return;

    const audioClip = new AudioClip(soundData);

    audioClip.send(channel1);
    audioClip.send(channel2);

    channel1.send(master);
    channel2.send(master);

    channel1.pan(-1);
    channel2.pan(1);

    window.addEventListener("click", function () {
        audioClip.play();
    });

})();